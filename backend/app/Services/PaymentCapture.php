<?php

namespace App\Services;

use App\Models\DownloadEntitlement;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

class PaymentCapture
{
    /** Shared by checkout verification and webhook reconciliation. Never call with browser-supplied payment data. */
    public function apply(array $payment): Order
    {
        return DB::transaction(function () use ($payment) {
            $order = Order::where('gateway_order_id', $payment['order_id'] ?? '')->lockForUpdate()->firstOrFail();
            abort_unless(($payment['status'] ?? '') === 'captured' && ($payment['captured'] ?? false) === true, 422, 'Payment is not captured.');
            abort_unless(is_int($payment['amount'] ?? null) && $payment['amount'] === $order->amount_paise && ($payment['currency'] ?? '') === $order->currency, 422, 'Payment amount or currency mismatch.');
            abort_unless(preg_match('/^pay_[A-Za-z0-9]+$/D', $payment['id'] ?? ''), 422);
            $existing = Payment::where('gateway_payment_id', $payment['id'])->first();
            abort_if($existing && $existing->order_id !== $order->id, 409, 'Payment belongs to another order.');
            // Refunds cannot be reversed by a delayed capture notification.
            if ($order->status === 'refunded') {
                return $order;
            }
            Payment::updateOrCreate(['gateway_payment_id' => $payment['id']], ['order_id' => $order->id, 'amount_paise' => $order->amount_paise, 'status' => 'captured', 'captured_at' => now()]);
            $order->update(['status' => 'paid']);
            DownloadEntitlement::firstOrCreate(['user_id' => $order->user_id, 'book_id' => $order->book_id], ['order_id' => $order->id]);

            return $order;
        }, 3);
    }

    public function refund(array $payment): void
    {
        DB::transaction(function () use ($payment) {
            $order = Order::where('gateway_order_id', $payment['order_id'] ?? '')->lockForUpdate()->firstOrFail();
            $p = Payment::where('order_id', $order->id)->where('gateway_payment_id', $payment['id'] ?? '')->firstOrFail();
            // Conservative policy: any refund revokes download access until reviewed.
            $p->update(['status' => 'refunded']);
            $order->update(['status' => 'refunded']);
            DownloadEntitlement::where('order_id', $order->id)->update(['revoked_at' => now()]);
        });
    }
}
