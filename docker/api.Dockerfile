# syntax=docker/dockerfile:1
FROM php:8.3-cli-bookworm
RUN --mount=type=secret,id=proxy_ca,required=false \
    if [ -f /run/secrets/proxy_ca ]; then export CURL_CA_BUNDLE=/run/secrets/proxy_ca; fi; \
    apt-get update && apt-get install -y --no-install-recommends git unzip libzip-dev libonig-dev libxml2-dev libsqlite3-dev poppler-utils ca-certificates \
    && docker-php-ext-install -j2 pdo_mysql pdo_sqlite mbstring zip pcntl dom \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /app
RUN groupadd -g 1000 app && useradd -u 1000 -g app -m app
USER app
EXPOSE 8000
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
