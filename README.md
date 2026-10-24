# ReadDuniya

**Har Kitaab, Ek Nayi Duniya.** A bilingual Hindi/English book catalogue, private online reader and paid PDF library for `readduniya.in`.

React 19 + TypeScript + Vite + Tailwind 4; Laravel 12 + Sanctum; MySQL 8.4; Razorpay Standard Checkout. See [architecture and milestones](docs/ARCHITECTURE.md), [security](docs/SECURITY.md), [deployment](docs/DEPLOYMENT.md) and [validation](docs/VALIDATION.md).

## Local development

Prerequisites: Docker Engine with Compose, Node 22+ / npm, or run Node in Docker. PHP 8.3+, Composer 2, Poppler (`pdfinfo`, `pdftoppm`, `pdftotext`) are included in the API image. Use the existing checkout; a separate worktree is unnecessary.

```sh
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Set MYSQL_PASSWORD and MYSQL_ROOT_PASSWORD in root .env; set the same
# MYSQL_PASSWORD as DB_PASSWORD in backend/.env. Do not commit these files.
docker compose build api
docker compose up -d db
docker compose run --rm api composer install --no-interaction --prefer-dist
docker compose run --rm api php artisan key:generate
# Creates tables and eight synthetic catalogue entries; one original one-page PDF.
docker compose run --rm api php artisan migrate --seed
cd frontend && npm ci && cd ..
docker compose up -d api worker scheduler frontend
```

Open the local frontend on port 5173. The Vite server proxies `/api` and `/sanctum` to Laravel, so browser cookies remain first party. The worker renders the original synthetic sample (The Art of Beginning). Other seed titles have metadata only and explicitly disabled reading/downloads. No copyrighted full books or predictable admin password are included.

Register a normal account, then explicitly promote it:

```sh
docker compose exec api php artisan read-duniya:admin your-email@example.com
```

Readiness checks:

```sh
curl --fail http://localhost:8000/up
curl --fail http://localhost:5173/api/books
# First book should transition from pending to ready with page_count=1.
docker compose exec api php artisan queue:failed
docker compose run --rm tests
docker compose exec api vendor/bin/pint --test
cd frontend && npm run lint && npm run build
```

For a MySQL test run, create a **separate disposable** `readduniya_test` database and account, then override `DB_CONNECTION`, `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` on `php artisan test`. RefreshDatabase destroys test tables; never point tests at application/production data. The default PHPUnit configuration uses isolated SQLite memory. CI also runs MySQL.

Behind a managed HTTPS proxy, pass a trusted combined CA bundle through `BUILD_CA_FILE`; do not disable TLS verification. Docker proxy settings are inherited from the environment. Composer source mode (`--prefer-source`) with `GIT_SSL_CAINFO` pointing to the mounted CA is supported when GitHub archive API access is unavailable. Never commit the session CA, caches, or credentials.

## Workflow

- Explore `/books`, genre and language filters, title/author search, pagination, details and JSON-LD Book metadata.
- Register/login; session cookies, CSRF, password hashing, role policies. The registration API ignores `role` input.
- `/admin`: catalogue editor, PDF/cover replacement, draft/publish, rights confirmation with actor/time, retry rendering, taxonomies, readers/roles, order/payment filters, captured-sales chart and settings.
- PDF originals and page images are private. Only a published rights-confirmed title can be read; every expiring image/text route checks current permissions, account and session.
- Reader: pagination, zoom, dark shell, extracted accessible text, personal watermark overlay, bookmarks and progress. Scanned PDFs need a separately prepared accessible text edition; extracted text is not OCR.
- Purchase: server creates a database-priced INR order; Standard Checkout returns a signature; Laravel verifies it and independently fetches captured payment status. Signed webhooks reconcile late capture and revoke entitlements after refunds. Downloads require an entitlement and a short-lived signed URL, checked again at serving time.
- Purchase history and repeat downloads live in `/dashboard`. Purchased titles are retired rather than hard-deleted. Refunds are issued in Razorpay, never simulated by changing a database status in the admin UI.

## Razorpay test mode and mock tests

Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` only in **backend/.env** / secret manager. Configure auto-capture in Razorpay and subscribe to `payment.captured`, `order.paid`, `payment.refunded` at `https://readduniya.in/api/payments/webhook`. Use the exact configured webhook secret (not the API secret); signatures cover the raw request bytes. Event IDs are persisted and locked transactionally. Test checkout with Razorpay's documented test instruments; never use real payment details in test mode.

There is deliberately no browser-accessible fake payment-success switch. PHPUnit uses `Http::fake()` and synthetic captured payloads for the complete order/verify/webhook/download workflow, without real keys or network calls. Missing keys return an explicit service-unavailable response; they cannot grant free entitlements. Do not expose backend secrets through `VITE_*` variables.

A paid order grants persistent repeat-download access, subject to current title availability and refunds. Any refund conservatively revokes access until support review. Do not charge again for a delayed capture; check history and webhook delivery. Out-of-order events retry safely. Duplicate capture on distinct orders requires operator reconciliation/refund; the app prevents concurrent checkout creation and reuses pending orders but cannot prevent a user paying an old provider checkout after a replacement order exists.

## Important boundaries

This is a production-oriented implementation, **not a claim of a completed production launch or security certification**. Screenshots, recording and device photography cannot be prevented. Page images, signed routes, throttles and overlays are deterrents, not DRM. Text mode intentionally makes content accessible. Review the placeholder legal pages, operations runbook, actual licensing, payment settings, vulnerability reports, backups, browser accessibility and production load before launch. Domain registration/DNS, HTTPS, live Razorpay credentials, mail delivery, deployment and PR merge remain operator actions.

Frontend metadata is set in React and includes JSON-LD. For crawlers without JavaScript and social cards, deploy an SSR/prerender layer for public book URLs; authenticated reader pages must never be prerendered or cached. See deployment notes.

## Browser smoke test

With the local Compose services running and Chromium installed (`CHROMIUM_PATH` defaults to `/usr/bin/chromium`), run `cd frontend && npm run smoke`. The Playwright smoke test creates a random temporary local account, exercises catalogue/language filtering, registration, private reader image/text, bookmarks/progress, authorization, admin screens and mobile layout, then deletes its account. It uses Docker Compose to temporarily promote that test account; it refuses non-loopback targets. `SMOKE_SCREENSHOT_DIR` optionally selects an existing output directory. No reusable credentials are seeded or printed.

## Initial pull request

The remote repository initially had no commits or `main` branch. The implementation branch targets an empty `bootstrap/review-base` branch so the complete implementation can be reviewed without a direct push to `main`. After review/merge, the repository owner can rename the resulting branch to `main` and configure branch protection. Nothing in this task changes production DNS or deploys the domain.
