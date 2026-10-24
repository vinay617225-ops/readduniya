<?php

return ['paths' => ['api/*', 'sanctum/csrf-cookie'], 'allowed_methods' => ['*'], 'allowed_origins' => array_filter(explode(',', env('FRONTEND_URL', 'http://localhost:5173'))), 'allowed_origins_patterns' => [], 'allowed_headers' => ['Content-Type', 'X-XSRF-TOKEN', 'X-Requested-With', 'Accept'], 'exposed_headers' => [], 'max_age' => 600, 'supports_credentials' => true];
