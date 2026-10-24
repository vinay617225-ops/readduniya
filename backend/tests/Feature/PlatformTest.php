<?php

namespace Tests\Feature;

use App\Jobs\RenderBook;
use App\Models\Author;
use App\Models\Book;
use App\Models\Category;
use App\Models\DownloadEntitlement;
use App\Models\Language;
use App\Models\Order;
use App\Models\User;
use App\Services\PaymentCapture;
use App\Services\SamplePdf;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class PlatformTest extends TestCase
{
    use RefreshDatabase;

    private function book(array $attrs = []): Book
    {
        $author = Author::firstOrCreate(['name' => 'Synthetic Author']);
        $lang = Language::firstOrCreate(['code' => 'en'], ['name' => 'English']);
        $curator = User::factory()->create();

        return Book::create(array_merge(['title' => 'An Original Sample', 'slug' => 'sample-'.Str::random(8), 'description' => 'Original synthetic test content.', 'author_id' => $author->id, 'language_id' => $lang->id, 'rights_status' => 'owned', 'rights_evidence' => 'Created in test', 'rights_confirmed_by' => $curator->id, 'rights_confirmed_at' => now(), 'status' => 'published', 'read_available' => true, 'download_available' => true, 'download_price_paise' => 2000, 'render_status' => 'ready', 'page_count' => 1], $attrs));
    }

    private function order(User $u, Book $b): Order
    {
        return Order::create(['reference' => (string) Str::uuid(), 'user_id' => $u->id, 'book_id' => $b->id, 'amount_paise' => 2000, 'currency' => 'INR', 'status' => 'pending', 'gateway_order_id' => 'order_'.Str::random(12)]);
    }

    private function captured(Order $o, array $change = []): array
    {
        return array_merge(['id' => 'pay_'.Str::random(12), 'order_id' => $o->gateway_order_id, 'amount' => 2000, 'currency' => 'INR', 'status' => 'captured', 'captured' => true], $change);
    }

    private function credentials(): void
    {
        config(['readduniya.razorpay.key_id' => 'rzp_test_example', 'readduniya.razorpay.key_secret' => 'test-secret', 'readduniya.razorpay.webhook_secret' => 'webhook-test-secret']);
    }

    public function test_catalogue_excludes_drafts_and_unverified_rights(): void
    {
        $good = $this->book();
        $this->book(['status' => 'draft']);
        $this->book(['rights_status' => 'unverified']);
        $this->book(['rights_confirmed_at' => null]);
        $this->getJson('/api/books')->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.id', $good->id)->assertJsonMissingPath('data.0.rights_evidence');
    }

    public function test_register_cannot_elevate_role_and_password_is_hashed(): void
    {
        $this->postJson('/api/register', ['name' => 'Reader', 'email' => 'reader@example.test', 'password' => 'long-password123', 'password_confirmation' => 'long-password123', 'role' => 'admin'])->assertCreated()->assertJsonPath('role', 'reader')->assertJsonMissingPath('password');
        $this->assertNotSame('long-password123', User::whereEmail('reader@example.test')->first()->password);
    }

    public function test_login_regenerates_authenticated_session_and_logout_revokes_it(): void
    {
        $u = User::factory()->create(['password' => 'long-password123']);
        $this->postJson('/api/login', ['email' => $u->email, 'password' => 'wrong'])->assertUnprocessable();
        $this->postJson('/api/login', ['email' => $u->email, 'password' => 'long-password123'])->assertOk();
        $this->assertAuthenticatedAs($u);
        $this->postJson('/api/logout')->assertNoContent();
        $this->assertGuest();
    }

    public function test_admin_and_private_routes_reject_guests_and_readers(): void
    {
        $b = $this->book();
        $this->getJson('/api/admin/books')->assertUnauthorized();
        $this->getJson('/api/reader/'.$b->id)->assertUnauthorized();
        $this->actingAs(User::factory()->create())->getJson('/api/admin/books')->assertForbidden();
        $this->getJson('/api/downloads/'.$b->id)->assertForbidden();
    }

    public function test_admin_requires_rights_confirmation_and_valid_pdf(): void
    {
        Storage::fake('local');
        Queue::fake();
        $u = User::factory()->create(['role' => 'admin']);
        $b = $this->book();
        $c = Category::create(['name' => 'Fiction', 'slug' => 'fiction']);
        $data = ['title' => 'New title', 'slug' => 'new-title', 'author_id' => $b->author_id, 'language_id' => $b->language_id, 'description' => 'Synthetic sample', 'rights_status' => 'owned', 'status' => 'published', 'read_available' => true, 'download_available' => true, 'download_price_paise' => 1000, 'category_ids' => [$c->id], 'pdf' => UploadedFile::fake()->createWithContent('sample.pdf', SamplePdf::bytes())];
        $this->actingAs($u)->postJson('/api/admin/books', $data)->assertUnprocessable();
        $data['confirm_rights'] = true;
        $data['rights_evidence'] = 'Original sample produced by ReadDuniya';
        $this->postJson('/api/admin/books', $data)->assertCreated()->assertJsonPath('rights_confirmed_by', $u->id)->assertJsonPath('render_status', 'pending');
        $new = Book::whereSlug('new-title')->firstOrFail();
        $f = $new->files()->where('kind', 'pdf')->firstOrFail();
        Storage::disk('local')->assertExists($f->path);
        $this->assertStringNotContainsString('sample.pdf', $f->path);
        Queue::assertPushed(RenderBook::class);
    }

    public function test_upload_rejects_executable_disguised_as_pdf_and_svg_cover(): void
    {
        Storage::fake('local');
        $b = $this->book();
        $admin = User::factory()->create(['role' => 'admin']);
        $d = ['title' => 'Unsafe', 'slug' => 'unsafe', 'author_id' => $b->author_id, 'language_id' => $b->language_id, 'description' => 'x', 'rights_status' => 'unverified', 'status' => 'draft', 'read_available' => false, 'download_available' => false, 'download_price_paise' => 1000, 'category_ids' => [], 'pdf' => UploadedFile::fake()->createWithContent('payload.pdf', '<?php echo 1;'), 'cover' => UploadedFile::fake()->createWithContent('cover.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')];
        $this->actingAs($admin)->postJson('/api/admin/books', $d)->assertUnprocessable();
    }

    public function test_render_job_produces_page_images_from_original_synthetic_pdf(): void
    {
        Storage::fake('local');
        $b = $this->book(['render_status' => 'pending', 'page_count' => 0]);
        $pdf = SamplePdf::bytes();
        Storage::put('test.pdf', $pdf);
        $hash = hash('sha256', $pdf);
        $b->files()->create(['kind' => 'pdf', 'disk' => 'local', 'path' => 'test.pdf', 'mime' => 'application/pdf', 'size' => strlen($pdf), 'sha256' => $hash]);
        (new RenderBook($b->id, $hash))->handle();
        $this->assertSame('ready', $b->fresh()->render_status);
        $this->assertSame(1, $b->fresh()->page_count);
        Storage::assertExists('pages/'.$b->id.'/'.$hash.'/1.jpg');
    }

    public function test_reader_pages_check_signature_session_and_current_permissions(): void
    {
        Storage::fake('local');
        $b = $this->book();
        $u = User::factory()->create();
        $hash = str_repeat('a', 64);
        $b->files()->create(['kind' => 'pdf', 'disk' => 'local', 'path' => 'secret.pdf', 'mime' => 'application/pdf', 'size' => 50, 'sha256' => $hash]);
        Storage::put('pages/'.$b->id.'/'.$hash.'/1.jpg', 'image');
        $this->actingAs($u);
        $manifest = $this->getJson('/api/reader/'.$b->id)->assertOk()->json();
        $this->withCookie(config('session.cookie'), session()->getId())->get($manifest['url'])->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->get(str_replace('page=1', 'page=2', $manifest['url']).'&tampered=yes')->assertForbidden();
        $this->actingAs(User::factory()->create())->get($manifest['url'])->assertForbidden();
        $this->actingAs($u);
        $b->update(['status' => 'draft']);
        $this->getJson($manifest['url'])->assertForbidden();
    }

    public function test_reader_rejects_out_of_range_and_tracks_only_own_progress(): void
    {
        $b = $this->book();
        $u = User::factory()->create();
        $this->actingAs($u)->putJson('/api/reader/'.$b->id.'/progress', ['page' => 2])->assertUnprocessable();
        $this->putJson('/api/reader/'.$b->id.'/progress', ['page' => 1, 'user_id' => 999])->assertCreated();
        $this->assertDatabaseHas('reading_progress', ['user_id' => $u->id, 'book_id' => $b->id, 'page' => 1]);
        $this->postJson('/api/reader/'.$b->id.'/bookmarks', ['page' => 1])->assertCreated();
        $this->postJson('/api/reader/'.$b->id.'/bookmarks', ['page' => 1])->assertOk();
        $this->assertDatabaseCount('bookmarks', 1);
    }

    public function test_order_amount_is_database_price_and_pending_checkout_is_reused(): void
    {
        $this->credentials();
        Http::preventStrayRequests();
        Http::fake(['api.razorpay.com/v1/orders' => Http::response(['id' => 'order_example', 'amount' => 2000, 'currency' => 'INR'])]);
        $b = $this->book();
        $u = User::factory()->create();
        $this->actingAs($u)->postJson('/api/books/'.$b->id.'/orders', ['amount' => 1])->assertOk()->assertJsonPath('amount', 2000)->assertJsonPath('key_id', 'rzp_test_example');
        $this->postJson('/api/books/'.$b->id.'/orders')->assertOk();
        Http::assertSentCount(1);
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('download_entitlements', 0);
    }

    public function test_authorized_payment_and_bad_signatures_cannot_grant_downloads(): void
    {
        $this->credentials();
        $b = $this->book();
        $u = User::factory()->create();
        $o = $this->order($u, $b);
        $p = $this->captured($o, ['status' => 'authorized', 'captured' => false]);
        Http::fake(['api.razorpay.com/v1/payments/*' => Http::response($p)]);
        $d = ['razorpay_order_id' => $o->gateway_order_id, 'razorpay_payment_id' => $p['id'], 'razorpay_signature' => str_repeat('0', 64)];
        $this->actingAs($u)->postJson('/api/payments/verify', $d)->assertUnprocessable();
        $d['razorpay_signature'] = hash_hmac('sha256', $o->gateway_order_id.'|'.$p['id'], 'test-secret');
        $this->postJson('/api/payments/verify', $d)->assertUnprocessable();
        $this->assertDatabaseCount('download_entitlements', 0);
        $this->postJson('/api/books/'.$b->id.'/download-link')->assertForbidden();
    }

    public function test_verified_capture_is_idempotent_and_enables_repeat_downloads(): void
    {
        Storage::fake('local');
        $this->credentials();
        $u = User::factory()->create();
        $b = $this->book();
        $o = $this->order($u, $b);
        $p = $this->captured($o);
        Http::fake(['api.razorpay.com/v1/payments/*' => Http::response($p)]);
        $d = ['razorpay_order_id' => $o->gateway_order_id, 'razorpay_payment_id' => $p['id'], 'razorpay_signature' => hash_hmac('sha256', $o->gateway_order_id.'|'.$p['id'], 'test-secret')];
        $this->actingAs($u)->postJson('/api/payments/verify', $d)->assertOk()->assertJsonPath('status', 'paid');
        $this->postJson('/api/payments/verify', $d)->assertOk();
        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseCount('download_entitlements', 1);
        Storage::put('private.pdf', SamplePdf::bytes());
        $b->files()->create(['kind' => 'pdf', 'disk' => 'local', 'path' => 'private.pdf', 'size' => 100, 'sha256' => str_repeat('b', 64), 'mime' => 'application/pdf']);
        $url = $this->postJson('/api/books/'.$b->id.'/download-link')->assertOk()->json('url');
        $this->withCookie(config('session.cookie'), session()->getId())->get($url)->assertOk()->assertDownload($b->slug.'.pdf');
        $this->get($url)->assertOk();
        $this->assertDatabaseCount('download_logs', 2);
        $this->postJson('/api/books/'.$b->id.'/orders')->assertConflict();
        $this->actingAs(User::factory()->create())->get($url)->assertForbidden();
    }

    public function test_capture_rejects_wrong_amount_currency_and_order_owner(): void
    {
        $b = $this->book();
        $u = User::factory()->create();
        $o = $this->order($u, $b);
        foreach ([['amount' => 1], ['currency' => 'USD']] as $change) {
            try {
                app(PaymentCapture::class)->apply($this->captured($o, $change));
                $this->fail('Expected rejection');
            } catch (HttpException $e) {
                $this->assertSame(422, $e->getStatusCode());
            }
        }
        $this->credentials();
        $this->actingAs(User::factory()->create())->postJson('/api/payments/verify', ['razorpay_order_id' => $o->gateway_order_id, 'razorpay_payment_id' => 'pay_wrong', 'razorpay_signature' => str_repeat('0', 64)])->assertNotFound();
        $this->assertDatabaseCount('download_entitlements', 0);
    }

    private function webhook(array $payload, string $id = 'evt_1', ?string $sig = null)
    {
        $body = json_encode($payload);

        return $this->call('POST', '/api/payments/webhook', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_X_RAZORPAY_EVENT_ID' => $id, 'HTTP_X_RAZORPAY_SIGNATURE' => $sig ?? hash_hmac('sha256', $body, 'webhook-test-secret')], $body);
    }

    public function test_signed_webhook_reconciles_capture_and_deduplicates_events(): void
    {
        $this->credentials();
        $u = User::factory()->create();
        $b = $this->book();
        $o = $this->order($u, $b);
        $p = $this->captured($o);
        $payload = ['event' => 'payment.captured', 'payload' => ['payment' => ['entity' => $p]]];
        $this->webhook($payload, 'evt_1', 'bad')->assertUnauthorized();
        $this->webhook($payload)->assertOk();
        $this->webhook($payload)->assertOk()->assertJsonPath('duplicate', true);
        $this->assertDatabaseCount('webhooks', 1);
        $this->assertDatabaseCount('download_entitlements', 1);
        $this->assertDatabaseHas('orders', ['id' => $o->id, 'status' => 'paid']);
        $payload['event'] = 'payment.refunded';
        $this->webhook($payload, 'evt_refund')->assertOk();
        $this->assertNotNull(DownloadEntitlement::first()->revoked_at);
        $payload['event'] = 'payment.captured';
        $this->webhook($payload, 'evt_delayed')->assertOk();
        $this->assertSame('refunded', $o->fresh()->status);
        $this->assertNotNull(DownloadEntitlement::first()->revoked_at);
    }

    public function test_expired_signed_download_is_rejected_even_with_entitlement(): void
    {
        $u = User::factory()->create();
        $b = $this->book();
        $o = $this->order($u, $b);
        app(PaymentCapture::class)->apply($this->captured($o));
        $this->actingAs($u);
        $url = URL::temporarySignedRoute('download.file', now()->subMinute(), ['book' => $b->id, 'user' => $u->id, 'session' => hash('sha256', session()->getId())], absolute: false);
        $this->get($url)->assertForbidden();
    }

    public function test_synthetic_seeder_is_repeatable(): void
    {
        Queue::fake();
        Storage::fake('local');
        $this->seed();
        $this->seed();
        $this->assertDatabaseCount('books', 8);
        $this->assertDatabaseCount('book_files', 1);
        $this->assertDatabaseCount('users', 1);
        $this->assertSame(0, User::where('role', 'admin')->count());
    }

    public function test_browser_mutations_require_csrf_outside_test_bypass(): void
    {
        $this->app['env'] = 'local';
        $this->postJson('/api/login', ['email' => 'test@example.test', 'password' => 'anything'])->assertStatus(419);
    }

    public function test_cors_does_not_allow_an_untrusted_browser_origin(): void
    {
        $response = $this->withHeader('Origin', 'https://untrusted.example')->getJson('/api/books');
        $this->assertNotSame('https://untrusted.example', $response->headers->get('Access-Control-Allow-Origin'));
    }

    public function test_taxonomies_are_admin_only_and_cannot_delete_in_use_entries(): void
    {
        $b = $this->book();
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->postJson('/api/admin/taxonomies/categories', ['name' => 'कविता', 'slug' => 'kavita'])->assertCreated();
        $this->postJson('/api/admin/taxonomies/categories', ['name' => 'कविता', 'slug' => 'kavita'])->assertUnprocessable();
        $this->deleteJson('/api/admin/taxonomies/authors/'.$b->author_id)->assertConflict();
        $c = Category::whereSlug('kavita')->first();
        $this->patchJson('/api/admin/taxonomies/categories/'.$c->id, ['name' => 'Poetry', 'slug' => 'poetry'])->assertOk();
        $this->deleteJson('/api/admin/taxonomies/categories/'.$c->id)->assertNoContent();
    }

    public function test_retired_book_revokes_even_previously_signed_download_links(): void
    {
        $u = User::factory()->create();
        $b = $this->book();
        $o = $this->order($u, $b);
        app(PaymentCapture::class)->apply($this->captured($o));
        $url = $this->actingAs($u)->postJson('/api/books/'.$b->id.'/download-link')->assertOk()->json('url');
        $b->update(['download_available' => false]);
        $this->get($url)->assertForbidden();
    }

    public function test_webhook_payload_collision_is_rejected(): void
    {
        $this->credentials();
        $payload = ['event' => 'subscription.test'];
        $this->webhook($payload)->assertOk();
        $payload['event'] = 'different.test';
        $this->webhook($payload)->assertConflict();
        $this->assertDatabaseCount('webhooks', 1);
    }
}
