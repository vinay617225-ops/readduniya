# Production runbook — readduniya.in

Docker Compose in this repository is **development-only**: it uses Vite and `artisan serve` and binds ports to loopback. Do not expose those processes as a production service.

1. Provision a Linux application host/container platform with PHP 8.3+ FPM (PDO MySQL, mbstring, DOM/XML, fileinfo, curl, zip, pcntl for workers), Composer 2, patched Poppler and Node 22 for builds. Run app and workers as a non-root user. MySQL 8.4 must be private and use dedicated least-privilege runtime credentials; use a separate migration credential when practical.
2. Deploy an immutable release checkout and `composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader` in backend; `npm ci && npm run build` in frontend. Serve frontend/dist through Nginx; route `/api`, `/sanctum`, `/up` to backend/public/index.php via PHP-FPM. No requests may reach backend/storage, `.env`, vendor, source files or arbitrary PHP paths. SPA fallback is `index.html`; the API fallback remains Laravel. Example routing below is a starting point, not a complete TLS configuration.
3. Set production environment securely: APP_ENV=production, APP_DEBUG=false, APP_URL=https://readduniya.in, FRONTEND_URL=https://readduniya.in, SANCTUM_STATEFUL_DOMAINS=readduniya.in, SESSION_SECURE_COOKIE=true, SESSION_ENCRYPT=true, SESSION_SAME_SITE=lax, SESSION_DOMAIN=readduniya.in, DB_*, APP_KEY, CACHE_STORE=database, QUEUE_CONNECTION=database. Generate APP_KEY once and preserve it securely. APP_URL must agree with public URLs. Configure trusted ingress proxy addresses in bootstrap/app.php if TLS terminates upstream; only trust actual controlled proxy ranges.
4. Set server-only Razorpay key ID/API secret and webhook secret; configure verified business/live credentials manually in Razorpay. Auto-capture must be enabled. Subscribe to payment.captured, order.paid, payment.refunded at `/api/payments/webhook`. The endpoint requires HTTPS and exact raw-body forwarding. Disable response caching and body rewriting. Monitor retries and alert on reconciliation errors. Read the README's test-mode process and test refunds before switching to live keys.
5. Set BOOK_DISK=s3 with AWS_BUCKET, AWS_DEFAULT_REGION and IAM/workload identity or secret-manager credentials; AWS_ENDPOINT and AWS_USE_PATH_STYLE_ENDPOINT for compatible providers. Block public bucket access. S3 Flysystem is included. Local private storage is also supported; all web/worker instances must then share that volume. Grant read/write only to the private book prefix. Do not configure a public storage CDN for originals or pages. Enforce encryption, versioning and lifecycle retention.
6. Run `php artisan migrate --force` once per release under a deployment lock, then `php artisan config:cache && php artisan route:cache`. Do not seed demonstration data in production unless explicitly wanted. Register the first real administrator, then run `php artisan read-duniya:admin email` deliberately. Remove or retire synthetic entries before launch.
7. Run supervised queue workers: `php artisan queue:work --sleep=2 --tries=2 --timeout=600 --max-time=3600`. Set the database queue `retry_after` above 600 (repository default: 660). Supervisor/systemd/Kubernetes must restart workers and allow at least 630 seconds for graceful shutdown. Use `php artisan queue:restart` after deploy. Isolate PDF rendering in a dedicated restricted worker runtime with CPU, RAM, PID and storage quotas. Monitor `queue:failed` and rendering status; after diagnosis, retry from admin or `queue:retry`.
8. Run cron as the application user: `* * * * * cd /srv/readduniya/backend && php artisan schedule:run >> /var/log/readduniya-scheduler.log 2>&1`. Run a single scheduler or shared locking cache. It expires stale pending orders; verified late capture may still reconcile them to paid.
9. Configure DNS A/AAAA for readduniya.in and optionally www; obtain a TLS certificate, redirect HTTP to HTTPS and www to canonical. These are manual steps; no DNS/hosting changes are performed by this project. Add HSTS only after confirming all relevant hosts use HTTPS. Secure the origin and block direct origin bypass if using a CDN.
10. Configure MAIL_* and actually provision hello@readduniya.in (or edit website settings), review legal placeholders with counsel, verify licensing and run acceptance/accessibility/load tests. A static SPA supplies client-side title/JSON-LD; add a server-rendered/prerendered public catalogue for social metadata and crawlers without JavaScript. Generate canonical tags, sitemap.xml and robots.txt from published titles only; exclude /admin, /dashboard, /read and /api private content. Do not cache authenticated API responses.

## Nginx routing sketch

Place these inside a hardened HTTPS server configuration, with frontend/dist as root. Configure actual FPM socket, certificate paths, upload/time limits, standard MIME types and security headers for the host.

```nginx
client_max_body_size 56m;
location / { try_files $uri /index.html; }
location ~ ^/(api|sanctum)(/|$) {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME /srv/readduniya/backend/public/index.php;
    fastcgi_param DOCUMENT_ROOT /srv/readduniya/backend/public;
    fastcgi_param HTTPS on;
    fastcgi_pass unix:/run/php/php8.3-fpm.sock;
}
location = /up {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME /srv/readduniya/backend/public/index.php;
    fastcgi_param HTTPS on;
    fastcgi_pass unix:/run/php/php8.3-fpm.sock;
}
location ~ /\. { deny all; }
location ~ \.php$ { return 404; }
```

Configure PHP `upload_max_filesize=50M`, `post_max_size=56M`, and proxy/FPM timeouts appropriate for uploads. Only writable Laravel storage and bootstrap/cache belong to the runtime user. A restrictive CSP must permit same-origin assets, Razorpay Checkout's current documented script/frame/connect destinations, and any required payment redirects; test with report-only first. Self-hosted fonts avoid third-party font requests. Add frame-ancestors 'none', object-src 'none', nosniff, Referrer-Policy and a suitable Permissions-Policy. Do not cache or prefetch signed reader/download URLs.

## Backups and recovery

Encrypt daily MySQL backups plus point-in-time binlogs and private storage backups/versioning. Keep keys separately, define RPO/RTO, restrict backup access and test restores in isolation monthly. Restores must include orders/payments/webhooks/entitlements together and the matching originals/pages. Reconcile gateway captures/refunds since the recovery point before reopening purchases. Preserve structured logs and payment event IDs without raw secrets. Monitor storage, DB/queue latency, rendering failures, 5xx errors, webhook retries and abnormal download volume.

Deploy rollback requires code + schema compatibility; never run destructive down migrations against live purchases to roll back an application release. Retain prior releases and take a verified backup before migrations. Perform a live smoke test using an approved low-value purchase only after credentials, legal terms and hosting are approved; this task does not perform live payments.
