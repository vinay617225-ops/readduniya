# ReadDuniya architecture and implementation plan

ReadDuniya serves a React/TypeScript/Vite/Tailwind client and a Laravel REST API on the same origin, with MySQL as the production database. The brand domain is readduniya.in; DNS and deployment are manual. Sanctum uses first-party session cookies, CSRF protection, session regeneration, and server-side role/policy checks. Browser storage never holds authentication tokens.

## Milestones
1. Foundation: Laravel, React, Docker Compose, session authentication, roles, normalized schema and synthetic seed data.
2. Catalogue/admin: searchable bilingual catalogue, details, admin book and taxonomy management, validated private uploads, publication rights audit fields.
3. Reader: convert private PDFs to raster pages with Poppler, serve signed session-bound pages after authorization, progress/bookmarks and accessible responsive controls.
4. Payments: database-priced Razorpay orders, captured-payment verification, signed idempotent webhooks, durable entitlements, expiring authorized download URLs and download audit logs.
5. Validation/deployment: security and payment tests, frontend build/type checks, CI, operations and legal-review documentation.

## Trust boundaries
Original PDFs never enter public storage. Page rendering runs asynchronously with resource limits. Each reader page and download checks current book permissions and session authentication, even when its signature is valid. Raster pages discourage casual extraction; screenshots, screen capture and photography cannot reliably be prevented. This is not DRM. Downloads require an entitlement created only from a verified captured payment. Prices are integer INR paise and originate only from the database. Browser payment success is never trusted alone. Razorpay API calls use TLS and server-held credentials; webhook HMAC uses the raw body and a separate secret.

## Data and operations
Users have a restricted role enum. Books belong to authors and languages; categories use a pivot; private file records track PDFs/covers/render manifests. Orders snapshot price and currency. Payments and webhook event IDs have unique constraints; capture and entitlement updates run in transactions with row locks. Queue workers process PDFs; the scheduler expires stale orders. SQLite supports isolated automated tests; MySQL integration must also be run before production. Backups include MySQL and private objects. Local filesystem is the default; S3-compatible private storage is configurable.

## Baseline
The requested repository is empty and the remote has no main branch. Work stays on feat/readduniya-platform. A GitHub pull request requires a base branch; no direct push to main is authorized. Use an empty bootstrap/review-base branch as the review target, leaving main untouched. After review, the owner can merge and rename the resulting default branch to main.
