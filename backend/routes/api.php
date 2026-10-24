<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CatalogController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ReaderController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/payments/webhook', [PaymentController::class, 'webhook'])->middleware('throttle:webhooks');
Route::middleware(['web', 'throttle:api'])->group(function () {
    Route::get('/sitemap.xml', [CatalogController::class, 'sitemap']);
    Route::get('/books', [CatalogController::class, 'index'])->middleware('throttle:catalog');
    Route::get('/books/{book}/cover', [CatalogController::class, 'cover']);
    Route::get('/catalog/{slug}', [CatalogController::class, 'show']);
    Route::get('/taxonomies', [CatalogController::class, 'taxonomies']);
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:authentication');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:authentication');
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', fn (Request $r) => $r->user());
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/dashboard', [ReaderController::class, 'dashboard']);
        Route::get('/reader/{book}', [ReaderController::class, 'manifest'])->middleware('throttle:reader-manifest');
        Route::get('/reader/{book}/pages/{page}', [ReaderController::class, 'page'])->whereNumber('page')->middleware(['signed:relative', 'throttle:reader-pages'])->name('reader.page');
        Route::get('/reader/{book}/text/{page}', [ReaderController::class, 'text'])->whereNumber('page')->middleware(['signed:relative', 'throttle:reader-pages'])->name('reader.text');
        Route::put('/reader/{book}/progress', [ReaderController::class, 'progress'])->middleware('throttle:progress');
        Route::post('/reader/{book}/bookmarks', [ReaderController::class, 'bookmark'])->middleware('throttle:bookmarks');
        Route::delete('/reader/{book}/bookmarks/{page}', [ReaderController::class, 'removeBookmark']);
        Route::post('/books/{book}/orders', [PaymentController::class, 'order'])->middleware('throttle:checkout');
        Route::post('/payments/verify', [PaymentController::class, 'verify'])->middleware('throttle:verification');
        Route::post('/books/{book}/download-link', [PaymentController::class, 'link'])->middleware('throttle:downloads');
        Route::get('/downloads/{book}', [PaymentController::class, 'download'])->middleware(['signed:relative', 'throttle:downloads'])->name('download.file');
        Route::prefix('admin')->middleware(['admin', 'throttle:admin'])->group(function () {
            Route::get('/summary', [AdminController::class, 'summary']);
            Route::get('/books', [AdminController::class, 'books']);
            Route::post('/books', [AdminController::class, 'save']);
            Route::post('/books/{book}', [AdminController::class, 'save']);
            Route::delete('/books/{book}', [AdminController::class, 'destroy']);
            Route::post('/books/{book}/render', [AdminController::class, 'retry']);
            Route::get('/orders', [AdminController::class, 'orders']);
            Route::get('/users', [AdminController::class, 'users']);
            Route::patch('/users/{user}/role', [AdminController::class, 'role']);
            Route::post('/taxonomies/{type}', [AdminController::class, 'taxonomy']);
            Route::patch('/taxonomies/{type}/{id}', [AdminController::class, 'taxonomy']);
            Route::delete('/taxonomies/{type}/{id}', [AdminController::class, 'deleteTaxonomy']);
            Route::put('/settings', [AdminController::class, 'settings']);
        });
    });
});
