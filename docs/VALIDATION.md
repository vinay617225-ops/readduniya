# Validation evidence

Validated in the managed Linux development environment with PHP 8.3, MySQL 8.4, Node 22/24, Composer 2 and Chromium.

- Backend: 22 passing tests / 102 assertions on isolated SQLite memory and on a separate MySQL `readduniya_test` database. Includes registration/role injection, session authentication/logout, CSRF enforcement, CORS origin restrictions, upload type/rights checks, actual Poppler rasterization, page signature/session authorization, bookmarks/progress, authoritative pricing, invalid/authorized vs captured payment handling, signed webhook idempotency/refunds, entitlement/download checks, and repeatable synthetic seeding.
- Frontend: ESLint, Prettier and TypeScript/Vite production build passed. Admin and reader routes are lazy-loaded; fonts are self-hosted.
- Browser: Playwright with system Chromium passed desktop/mobile catalogue, Hindi filter, registration, private image and extracted text reader, bookmarks, persisted reading history, unpaid download denial, admin dashboard, and logout. No uncaught page errors or horizontal overflow at 390px. Screenshots inspected at desktop and mobile widths. Run `npm run smoke` from the frontend working directory as described in the README.
- Infrastructure: development Docker image built, MySQL health check passed, API/frontend/queue/scheduler started, catalogue returned eight records, and the seeded original sample rendered to a one-page reader. Route cache compilation passed. Composer metadata validation and Pint passed. Production npm dependency audit reported zero vulnerabilities.
- Repeatability: cloud install script rerun against the prepared checkout; application keys and local configuration are preserved, lockfile installs are used, and seeding does not duplicate sample titles.

Razorpay network operations are mocked in automated tests; no live charge or externally delivered webhook was performed. Real test/live keys, Razorpay dashboard capture/webhook configuration and TLS hosting are still required. MySQL and S3 backup/restore, object-storage connectivity, production load, assistive-technology acceptance, legal review and production deployment are not claimed as validated. Text extraction is not OCR. SSR/social-card rendering is not included in this static SPA.

The test harness refuses non-SQLite databases whose names do not end in `_test`, and refuses SQLite files other than memory or a `test.sqlite` file. Use the Compose `tests` service, not the development API service, for the default test run.
