<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        // Named limiters keep independent counters; numeric middleware limits share keys.
        foreach (['api' => 180, 'admin' => 120, 'catalog' => 120, 'webhooks' => 120, 'reader-manifest' => 60, 'reader-pages' => 90, 'progress' => 60, 'bookmarks' => 30, 'checkout' => 5, 'verification' => 10, 'downloads' => 5] as $name => $limit) {
            RateLimiter::for($name, fn (Request $r) => Limit::perMinute($limit)->by($r->user()?->id ?: $r->ip()));
        }
        RateLimiter::for('authentication', fn (Request $r) => [
            Limit::perMinute(15)->by('ip:'.$r->ip()),
            Limit::perMinute(5)->by('account:'.hash('sha256', strtolower((string) $r->input('email')).'|'.$r->ip())),
        ]);
    }
}
