import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "API_");
  const target =
    process.env.API_PROXY || env.API_PROXY || "http://127.0.0.1:8000";
  return {
    plugins: [react(), tailwindcss()],
    server: { proxy: { "/api": target, "/sanctum": target } },
  };
});
