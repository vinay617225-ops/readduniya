<?php

use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('read-duniya:admin {email}', function () {
    $user = User::where('email', $this->argument('email'))->firstOrFail();
    $user->forceFill(['role' => 'admin'])->save();
    $this->info('Existing user promoted to admin.');
})->purpose('Promote a previously registered account; no default admin credentials.');
Schedule::call(fn () => Order::whereIn('status', ['creating', 'pending'])->where('created_at', '<', now()->subDay())->update(['status' => 'expired']))->hourly()->name('expire-orders')->withoutOverlapping();
