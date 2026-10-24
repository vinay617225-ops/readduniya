#!/bin/sh
# Reproducible setup for the isolated Linux cloud development machine.
set -eu
cd "$(dirname "$0")/.."
[ -f .env ] || cp .env.example .env
[ -f backend/.env ] || cp backend/.env.example backend/.env
[ -f frontend/.env ] || cp frontend/.env.example frontend/.env
if ! grep -q '^APP_ENV=local$' backend/.env; then
  echo 'Cloud setup only operates on APP_ENV=local; refusing to migrate another environment.' >&2
  exit 1
fi
export BUILDX_CONFIG="${BUILDX_CONFIG:-/tmp/readduniya-buildx}"
rd_ca_bundle="${BUILD_CA_FILE:-/etc/ssl/certs/ca-certificates.crt}"
docker compose build api
docker compose up -d db
docker compose run --rm -v "$rd_ca_bundle:/run/cloud-ca.pem:ro" \
  -e COMPOSER_CAFILE=/run/cloud-ca.pem -e COMPOSER_HOME=/tmp/composer \
  api composer install --prefer-dist --no-interaction
if ! grep -q '^APP_KEY=.' backend/.env; then
  docker compose run --rm api php artisan key:generate
fi
npm ci --prefix frontend --cache /tmp/readduniya-npm --no-audit --no-fund
docker compose run --rm api php artisan migrate --seed
npm run build --prefix frontend
