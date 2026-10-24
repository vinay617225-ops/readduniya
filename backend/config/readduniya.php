<?php

return [
    'disk' => env('BOOK_DISK', 'local'),
    'razorpay' => ['key_id' => env('RAZORPAY_KEY_ID'), 'key_secret' => env('RAZORPAY_KEY_SECRET'), 'webhook_secret' => env('RAZORPAY_WEBHOOK_SECRET')],
    'max_pages' => 1000,
];
