import { chromium } from "playwright-core";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const compose = fileURLToPath(new URL("../../compose.yaml", import.meta.url));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:5173";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error(
    "Smoke tests create local fixtures; only loopback targets are allowed.",
  );
const email = `smoke-${Date.now()}@example.invalid`;
const password = randomBytes(20).toString("hex");
try {
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Small escapes. Endless worlds." })
    .waitFor();
  await page.locator(".book-card").first().waitFor();
  await page.screenshot({
    path: process.env.SMOKE_SCREENSHOT_DIR
      ? `${process.env.SMOKE_SCREENSHOT_DIR}/desktop.png`
      : "/tmp/readduniya-desktop.png",
    fullPage: true,
  });
  await page.goto(base + "/books?language=hi");
  await page.getByText("4 books to discover", { exact: true }).waitFor();
  await page.goto(base + "/register");
  await page.getByLabel("Your name", { exact: true }).fill("Smoke Reader");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create your account" }).click();
  await page.waitForURL("**/dashboard");
  await page.getByRole("heading", { name: "Hello, Smoke." }).waitFor();
  const unauthorized = await page.request.get(base + "/api/admin/books");
  if (unauthorized.status() !== 403) throw new Error("Reader accessed admin");
  const sample = await (
    await page.request.get(base + "/api/catalog/the-art-of-beginning")
  ).json();
  await page.goto(base + "/books/the-art-of-beginning");
  await page.getByRole("link", { name: "Read for free" }).click();
  await page.locator(".reader-paper img").waitFor();
  await page.waitForFunction(() => {
    const i = document.querySelector(".reader-paper img");
    return i?.complete && i.naturalWidth > 0;
  });
  await page.getByRole("button", { name: "Accessible text" }).click();
  await page.getByText(/Every open page is a small beginning/).waitFor();
  await page.getByRole("button", { name: "Save page" }).click();
  await page.getByText("Page bookmarked.", { exact: true }).waitFor();
  await page.goto(base + "/dashboard");
  await page
    .getByRole("heading", { name: "Continue reading", exact: true })
    .waitFor();
  await page
    .locator(".library-list")
    .first()
    .getByText("The Art of Beginning", { exact: true })
    .waitFor();
  const deny = await page.evaluate(async (bookId) => {
    await fetch("/sanctum/csrf-cookie");
    const csrf = document.cookie
      .split("; ")
      .find((x) => x.startsWith("XSRF-TOKEN="))
      ?.slice(11);
    return (
      await fetch(`/api/books/${bookId}/download-link`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "X-XSRF-TOKEN": decodeURIComponent(csrf || ""),
        },
      })
    ).status;
  }, sample.id);
  if (deny !== 403)
    throw new Error(`Unpurchased download not blocked: ${deny}`);
  execFileSync(
    "docker",
    [
      "compose",
      "-f",
      compose,
      "exec",
      "-T",
      "api",
      "php",
      "artisan",
      "read-duniya:admin",
      email,
    ],
    { stdio: "pipe" },
  );
  await page.goto(base + "/admin");
  await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
  await page.getByRole("button", { name: "Books", exact: true }).click();
  await page.getByRole("button", { name: "Add a book" }).waitFor();
  await page.screenshot({
    path: process.env.SMOKE_SCREENSHOT_DIR
      ? `${process.env.SMOKE_SCREENSHOT_DIR}/admin.png`
      : "/tmp/readduniya-admin.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Small escapes. Endless worlds." })
    .waitFor();
  await page.screenshot({
    path: process.env.SMOKE_SCREENSHOT_DIR
      ? `${process.env.SMOKE_SCREENSHOT_DIR}/mobile.png`
      : "/tmp/readduniya-mobile.png",
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  if (overflow) throw new Error("Mobile page overflows viewport");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("link", { name: "Sign in", exact: true }).waitFor();
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "PASS: desktop/mobile catalogue, Hindi filter, registration/session, reader image/text, progress/bookmark, access denial, admin dashboard, logout; no page errors or mobile overflow.",
  );
} finally {
  await browser.close();
  execFileSync(
    "docker",
    [
      "compose",
      "-f",
      compose,
      "exec",
      "-T",
      "api",
      "php",
      "artisan",
      "tinker",
      `--execute=App\\Models\\User::where('email','${email}')->delete();`,
    ],
    { stdio: "pipe" },
  );
}
