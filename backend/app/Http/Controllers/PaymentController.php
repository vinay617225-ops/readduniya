<?php

namespace App\Http\Controllers;

use App\Models\Book;
use App\Models\DownloadEntitlement;
use App\Models\Order;
use App\Models\User;
use App\Models\Webhook;
use App\Services\PaymentCapture;
use App\Services\RazorpayGateway;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    public function order(Request $r, Book $book, RazorpayGateway $gateway)
    {
        abort_unless($book->isAuthorized() && $book->download_available, 403);
        if (DownloadEntitlement::where('user_id', $r->user()->id)->where('book_id', $book->id)->exists()) {
            return response()->json(['message' => 'A purchase already exists. Open your library or contact support.'], 409);
        }
        // Serialize creation per buyer to prevent concurrent duplicate checkout orders.
        $order = DB::transaction(function () use ($r, $book) {
            User::whereKey($r->user()->id)->lockForUpdate()->firstOrFail();
            $pending = Order::where('user_id', $r->user()->id)->where('book_id', $book->id)->whereIn('status', ['creating', 'pending'])->where('created_at', '>', now()->subMinutes(25))->first();
            if ($pending) {
                return $pending;
            }

            return Order::create(['reference' => (string) Str::uuid(), 'user_id' => $r->user()->id, 'book_id' => $book->id, 'amount_paise' => $book->download_price_paise, 'currency' => 'INR', 'status' => 'creating']);
        });
        if ($order->status === 'creating') {
            // Only the request acquiring this cache lock may contact the payment provider.
            return Cache::lock('order-'.$order->id, 30)->block(3, function () use ($order, $gateway) {
                $order->refresh();
                if (! $order->gateway_order_id) {
                    try {
                        $remote = $gateway->createOrder($order->amount_paise, $order->reference);
                    } catch (\Throwable $e) {
                        $order->update(['status' => 'failed']);
                        throw $e;
                    }
                    abort_unless(isset($remote['id']) && str_starts_with($remote['id'], 'order_') && ($remote['amount'] ?? null) === $order->amount_paise && ($remote['currency'] ?? '') === 'INR', 502, 'Invalid gateway order.');
                    $order->update(['gateway_order_id' => $remote['id'], 'status' => 'pending']);
                }

                return $this->checkout($order);
            });
        }

        return $this->checkout($order);
    }

    private function checkout(Order $o): array
    {
        return ['order_id' => $o->gateway_order_id, 'amount' => $o->amount_paise, 'currency' => 'INR', 'key_id' => config('readduniya.razorpay.key_id'), 'reference' => $o->reference];
    }

    public function verify(Request $r, RazorpayGateway $gateway, PaymentCapture $capture)
    {
        $d = $r->validate(['razorpay_order_id' => 'required|string|max:100', 'razorpay_payment_id' => 'required|string|max:100', 'razorpay_signature' => 'required|string|size:64']);
        $o = Order::where('gateway_order_id', $d['razorpay_order_id'])->where('user_id', $r->user()->id)->firstOrFail();
        abort_unless($gateway->validCheckoutSignature($o->gateway_order_id, $d['razorpay_payment_id'], $d['razorpay_signature']), 422, 'Invalid payment signature.');
        $p = $gateway->payment($d['razorpay_payment_id']);
        abort_unless(($p['order_id'] ?? '') === $o->gateway_order_id, 422);

        return $capture->apply($p);
    }

    public function webhook(Request $r, RazorpayGateway $gateway, PaymentCapture $capture)
    {
        $body = $r->getContent();
        abort_if(strlen($body) > 262144, 413);
        abort_unless($gateway->validWebhook($body, (string) $r->header('X-Razorpay-Signature')), 401);
        $eventId = (string) $r->header('X-Razorpay-Event-Id');
        abort_unless(preg_match('/^[A-Za-z0-9_-]{1,150}$/D', $eventId), 422);
        $data = json_decode($body, true, 32);
        abort_unless(is_array($data) && is_string($data['event'] ?? null) && strlen($data['event']) <= 100, 422, 'Invalid event payload.');
        $type = $data['event'];

        return DB::transaction(function () use ($eventId, $type, $body, $data, $capture) {
            DB::table('webhooks')->insertOrIgnore(['event_id' => $eventId, 'type' => $type, 'payload_hash' => hash('sha256', $body), 'created_at' => now(), 'updated_at' => now()]);
            $event = Webhook::where('event_id', $eventId)->lockForUpdate()->firstOrFail();
            abort_unless(hash_equals($event->payload_hash, hash('sha256', $body)), 409, 'Event ID collision.');
            if ($event->processed_at) {
                return ['received' => true, 'duplicate' => true];
            }
            if (in_array($type, ['payment.captured', 'order.paid'], true)) {
                $capture->apply($data['payload']['payment']['entity'] ?? []);
            }
            if ($type === 'payment.refunded') {
                $capture->refund($data['payload']['payment']['entity'] ?? []);
            }
            $event->update(['processed_at' => now()]);

            return ['received' => true];
        }, 3);
    }

    public function link(Request $r, Book $book)
    {
        Gate::authorize('download', $book);

        return ['url' => URL::temporarySignedRoute('download.file', now()->addMinutes(2), ['book' => $book->id, 'user' => $r->user()->id, 'session' => hash('sha256', $r->session()->getId())], absolute: false)];
    }

    public function download(Request $r, Book $book)
    {
        Gate::authorize('download', $book);
        abort_unless((int) $r->query('user') === $r->user()->id && hash_equals((string) $r->query('session'), hash('sha256', $r->session()->getId())), 403);
        $f = $book->files()->where('kind', 'pdf')->firstOrFail();
        DB::table('download_logs')->insert(['user_id' => $r->user()->id, 'book_id' => $book->id, 'ip_hash' => hash_hmac('sha256', (string) $r->ip(), config('app.key')), 'created_at' => now()]);

        return Storage::disk($f->disk)->download($f->path, $book->slug.'.pdf', ['Content-Type' => 'application/pdf', 'Cache-Control' => 'private,no-store']);
    }
}
