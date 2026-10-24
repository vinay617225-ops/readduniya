<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->enum('role', ['reader', 'admin'])->default('reader')->index();
        });
        Schema::create('authors', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();
            $t->text('bio')->nullable();
            $t->timestamps();
        });
        Schema::create('languages', function (Blueprint $t) {
            $t->id();
            $t->string('code', 8)->unique();
            $t->string('name');
            $t->timestamps();
        });
        Schema::create('categories', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();
            $t->string('slug')->unique();
            $t->timestamps();
        });
        Schema::create('books', function (Blueprint $t) {
            $t->id();
            $t->foreignId('author_id')->constrained()->restrictOnDelete();
            $t->foreignId('language_id')->constrained()->restrictOnDelete();
            $t->string('title');
            $t->string('slug')->unique();
            $t->text('description');
            $t->json('tags')->nullable();
            $t->unsignedSmallInteger('publication_year')->nullable();
            $t->string('publisher')->nullable();
            $t->string('isbn', 32)->nullable()->index();
            $t->enum('rights_status', ['unverified', 'owned', 'licensed', 'public_domain'])->default('unverified');
            $t->text('rights_evidence')->nullable();
            $t->foreignId('rights_confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('rights_confirmed_at')->nullable();
            $t->boolean('read_available')->default(false);
            $t->boolean('download_available')->default(false);
            $t->unsignedInteger('download_price_paise')->default(1000);
            $t->enum('status', ['draft', 'published'])->default('draft');
            $t->unsignedInteger('page_count')->default(0);
            $t->enum('render_status', ['pending', 'processing', 'ready', 'failed'])->default('pending');
            $t->text('render_error')->nullable();
            $t->timestamps();
            $t->index(['status', 'language_id']);
            $t->index(['status', 'created_at']);
        });
        Schema::create('book_category', function (Blueprint $t) {
            $t->foreignId('book_id')->constrained()->cascadeOnDelete();
            $t->foreignId('category_id')->constrained()->cascadeOnDelete();
            $t->primary(['book_id', 'category_id']);
        });
        Schema::create('book_files', function (Blueprint $t) {
            $t->id();
            $t->foreignId('book_id')->constrained()->cascadeOnDelete();
            $t->enum('kind', ['pdf', 'cover']);
            $t->string('disk');
            $t->string('path');
            $t->string('mime');
            $t->unsignedBigInteger('size');
            $t->string('sha256', 64);
            $t->timestamps();
            $t->unique(['book_id', 'kind']);
        });
        Schema::create('reading_progress', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('book_id')->constrained()->cascadeOnDelete();
            $t->unsignedInteger('page');
            $t->timestamps();
            $t->unique(['user_id', 'book_id']);
        });
        Schema::create('bookmarks', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('book_id')->constrained()->cascadeOnDelete();
            $t->unsignedInteger('page');
            $t->string('note', 500)->nullable();
            $t->timestamps();
            $t->unique(['user_id', 'book_id', 'page']);
        });
        Schema::create('orders', function (Blueprint $t) {
            $t->id();
            $t->uuid('reference')->unique();
            $t->foreignId('user_id')->constrained()->restrictOnDelete();
            $t->foreignId('book_id')->constrained()->restrictOnDelete();
            $t->unsignedInteger('amount_paise');
            $t->char('currency', 3)->default('INR');
            $t->enum('status', ['creating', 'pending', 'paid', 'failed', 'expired', 'refunded'])->default('creating');
            $t->string('gateway_order_id')->nullable()->unique();
            $t->timestamps();
            $t->index(['user_id', 'status']);
        });
        Schema::create('payments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('order_id')->constrained()->restrictOnDelete();
            $t->string('gateway_payment_id')->unique();
            $t->unsignedInteger('amount_paise');
            $t->string('status');
            $t->timestamp('captured_at')->nullable();
            $t->timestamps();
        });
        Schema::create('download_entitlements', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->restrictOnDelete();
            $t->foreignId('book_id')->constrained()->restrictOnDelete();
            $t->foreignId('order_id')->unique()->constrained()->restrictOnDelete();
            $t->timestamp('revoked_at')->nullable();
            $t->timestamps();
            $t->unique(['user_id', 'book_id']);
        });
        Schema::create('download_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->restrictOnDelete();
            $t->foreignId('book_id')->constrained()->restrictOnDelete();
            $t->string('ip_hash', 64);
            $t->timestamp('created_at');
            $t->index(['user_id', 'book_id', 'created_at']);
        });
        Schema::create('webhooks', function (Blueprint $t) {
            $t->id();
            $t->string('event_id')->unique();
            $t->string('type');
            $t->string('payload_hash', 64);
            $t->timestamp('processed_at')->nullable();
            $t->timestamps();
        });
        Schema::create('settings', function (Blueprint $t) {
            $t->string('key')->primary();
            $t->text('value');
            $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['settings', 'webhooks', 'download_logs', 'download_entitlements', 'payments', 'orders', 'bookmarks', 'reading_progress', 'book_files', 'book_category', 'books', 'categories', 'languages', 'authors'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn('role'));
    }
};
