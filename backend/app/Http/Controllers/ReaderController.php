<?php

namespace App\Http\Controllers;

use App\Models\Book;
use App\Models\Bookmark;
use App\Models\DownloadEntitlement;
use App\Models\Order;
use App\Models\ReadingProgress;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class ReaderController extends Controller
{
    public function manifest(Request $r, Book $book)
    {
        Gate::authorize('read', $book);
        $r->validate(['page' => 'nullable|integer|min:1']);
        $page = (int) $r->input('page', 1);
        abort_unless($page >= 1 && $page <= $book->page_count, 422);

        return ['page_count' => $book->page_count, 'page' => $page, 'url' => URL::temporarySignedRoute('reader.page', now()->addMinutes(2), ['book' => $book->id, 'page' => $page, 'user' => $r->user()->id, 'session' => hash('sha256', $r->session()->getId())], absolute: false), 'text_url' => URL::temporarySignedRoute('reader.text', now()->addMinutes(2), ['book' => $book->id, 'page' => $page, 'user' => $r->user()->id, 'session' => hash('sha256', $r->session()->getId())], absolute: false), 'watermark' => 'ReadDuniya · '.$r->user()->id.' · '.substr(hash('sha256', $r->session()->getId()), 0, 8), 'progress' => ReadingProgress::where('user_id', $r->user()->id)->where('book_id', $book->id)->first(), 'bookmarks' => Bookmark::where('user_id', $r->user()->id)->where('book_id', $book->id)->get()];
    }

    public function page(Request $r, Book $book, int $page)
    {
        Gate::authorize('read', $book);
        abort_unless((int) $r->query('user') === $r->user()->id && hash_equals((string) $r->query('session'), hash('sha256', $r->session()->getId())), 403);
        abort_unless($page >= 1 && $page <= $book->page_count, 404);
        $f = $book->files()->where('kind', 'pdf')->firstOrFail();

        return Storage::disk($f->disk)->response('pages/'.$book->id.'/'.$f->sha256.'/'.$page.'.jpg', null, ['Content-Type' => 'image/jpeg', 'Cache-Control' => 'private,no-store']);
    }

    public function text(Request $r, Book $book, int $page)
    {
        Gate::authorize('read', $book);
        abort_unless((int) $r->query('user') === $r->user()->id && hash_equals((string) $r->query('session'), hash('sha256', $r->session()->getId())), 403);
        abort_unless($page >= 1 && $page <= $book->page_count, 404);
        $f = $book->files()->where('kind', 'pdf')->firstOrFail();

        return response(Storage::disk($f->disk)->get('pages/'.$book->id.'/'.$f->sha256.'/'.$page.'.txt'), 200, ['Content-Type' => 'text/plain; charset=utf-8', 'Cache-Control' => 'private,no-store']);
    }

    public function progress(Request $r, Book $book)
    {
        Gate::authorize('read', $book);
        $d = $r->validate(['page' => 'required|integer|min:1|max:'.$book->page_count]);

        return ReadingProgress::updateOrCreate(['user_id' => $r->user()->id, 'book_id' => $book->id], $d);
    }

    public function bookmark(Request $r, Book $book)
    {
        Gate::authorize('read', $book);
        $d = $r->validate(['page' => 'required|integer|min:1|max:'.$book->page_count, 'note' => 'nullable|string|max:500']);

        return Bookmark::updateOrCreate(['user_id' => $r->user()->id, 'book_id' => $book->id, 'page' => $d['page']], $d);
    }

    public function removeBookmark(Request $r, Book $book, int $page)
    {
        Bookmark::where('user_id', $r->user()->id)->where('book_id', $book->id)->where('page', $page)->delete();

        return response()->noContent();
    }

    public function dashboard(Request $r)
    {
        return ['history' => ReadingProgress::with('book.author')->where('user_id', $r->user()->id)->latest('updated_at')->limit(30)->get(), 'bookmarks' => Bookmark::with('book')->where('user_id', $r->user()->id)->latest()->limit(100)->get(), 'orders' => Order::with(['book', 'payments'])->where('user_id', $r->user()->id)->latest()->paginate(20), 'entitlements' => DownloadEntitlement::with('book')->where('user_id', $r->user()->id)->whereNull('revoked_at')->get()];
    }
}
