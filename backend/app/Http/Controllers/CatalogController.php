<?php

namespace App\Http\Controllers;

use App\Models\Author;
use App\Models\Book;
use App\Models\Category;
use App\Models\Language;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CatalogController extends Controller
{
    public function index(Request $r)
    {
        $v = $r->validate(['q' => 'nullable|string|max:100', 'category' => 'nullable|string|max:100', 'language' => 'nullable|string|max:8', 'sort' => 'nullable|in:newest,title,price', 'page' => 'nullable|integer|min:1']);
        $q = Book::published()->with(['author', 'language', 'categories']);
        if ($r->filled('q')) {
            $q->where(function ($q) use ($v) {
                $q->where('title', 'like', '%'.$v['q'].'%')->orWhereHas('author', fn ($a) => $a->where('name', 'like', '%'.$v['q'].'%'));
            });
        }
        if ($r->filled('category')) {
            $q->whereHas('categories', fn ($q) => $q->where('slug', $v['category']));
        }
        if ($r->filled('language')) {
            $q->whereHas('language', fn ($q) => $q->where('code', $v['language']));
        }

        return $q->orderBy(match ($v['sort'] ?? 'newest') {
            'title' => 'title','price' => 'download_price_paise',default => 'created_at'
        }, ($v['sort'] ?? 'newest') === 'newest' ? 'desc' : 'asc')->orderBy('id', 'desc')->paginate(12);
    }

    public function show(string $slug)
    {
        return Book::published()->with(['author', 'language', 'categories'])->where('slug', $slug)->firstOrFail();
    }

    public function taxonomies()
    {
        return ['categories' => Category::orderBy('name')->get(), 'languages' => Language::all(), 'authors' => Author::orderBy('name')->get(), 'settings' => Setting::whereIn('key', ['announcement', 'contact_email'])->pluck('value', 'key')];
    }

    public function sitemap()
    {
        $base = rtrim(config('app.url'), '/');
        $xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
        foreach (Book::published()->select(['id', 'slug', 'updated_at'])->cursor() as $book) {
            $xml .= '<url><loc>'.htmlspecialchars($base.'/books/'.$book->slug, ENT_XML1).'</loc><lastmod>'.$book->updated_at->toDateString().'</lastmod></url>';
        }

        return response($xml.'</urlset>', 200, ['Content-Type' => 'application/xml']);
    }

    public function cover(Book $book)
    {
        abort_unless($book->isAuthorized(), 404);
        $file = $book->files()->where('kind', 'cover')->firstOrFail();

        return Storage::disk($file->disk)->response($file->path, null, ['Content-Type' => $file->mime, 'Cache-Control' => 'public,max-age=3600']);
    }
}
