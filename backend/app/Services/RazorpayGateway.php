<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class RazorpayGateway
{
    private function client()
    {
        abort_unless(config('readduniya.razorpay.key_id') && config('readduniya.razorpay.key_secret'), 503, 'Payments are not configured.');

        return Http::withBasicAuth(config('readduniya.razorpay.key_id'), config('readduniya.razorpay.key_secret'))->acceptJson()->timeout(20)->baseUrl('https://api.razorpay.com/v1');
    }

    public function createOrder(int $amount, string $receipt): array
    {
        return $this->client()->post('/orders', ['amount' => $amount, 'currency' => 'INR', 'receipt' => $receipt])->throw()->json();
    }

    public function payment(string $id): array
    {
        abort_unless(preg_match('/^pay_[A-Za-z0-9]+$/D', $id), 422);

        return $this->client()->get('/payments/'.$id)->throw()->json();
    }

    public function validCheckoutSignature(string $order, string $payment, string $signature): bool
    {
        $secret = config('readduniya.razorpay.key_secret');

        return $secret && hash_equals(hash_hmac('sha256', $order.'|'.$payment, $secret), $signature);
    }

    public function validWebhook(string $body, string $signature): bool
    {
        $secret = config('readduniya.razorpay.webhook_secret');

        return $secret && hash_equals(hash_hmac('sha256', $body, $secret), $signature);
    }
}
