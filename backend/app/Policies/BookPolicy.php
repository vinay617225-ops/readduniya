<?php

namespace App\Policies;

use App\Models\Book;
use App\Models\DownloadEntitlement;
use App\Models\User;

class BookPolicy
{
    public function manage(User $u): bool
    {
        return $u->role === 'admin';
    }

    public function read(User $u, Book $b): bool
    {
        return $b->isAuthorized() && $b->read_available && $b->render_status === 'ready';
    }

    public function download(User $u, Book $b): bool
    {
        return $b->isAuthorized() && $b->download_available && DownloadEntitlement::where('user_id', $u->id)->where('book_id', $b->id)->whereNull('revoked_at')->exists();
    }
}
