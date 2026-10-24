<?php

namespace App\Http\Controllers;

use App\Jobs\RenderBook;
use App\Models\Author;
use App\Models\Book;
use App\Models\Category;
use App\Models\Language;
use App\Models\Order;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    public function books(Request $r)
    {
        $r->validate(['q' => 'nullable|string|max:100', 'sort' => 'nullable|in:title,created_at,download_price_paise', 'direction' => 'nullable|in:asc,desc', 'status' => 'nullable|in:draft,published']);

        return Book::with(['author', 'language', 'categories', 'files'])->when($r->q, fn ($q) => $q->where('title', 'like', '%'.$r->q.'%'))->when($r->status, fn ($q) => $q->where('status', $r->status))->orderBy($r->input('sort', 'created_at'), $r->input('direction', 'desc'))->paginate(20);
    }

    public function save(Request $r, ?Book $book = null)
    {
        Gate::authorize('manage', Book::class);
        $book ??= new Book;
        $data = $r->validate([
            'title' => 'required|string|max:250', 'slug' => ['required', 'alpha_dash', 'max:250', Rule::unique('books')->ignore($book->id)],
            'author_id' => 'required|exists:authors,id', 'language_id' => 'required|exists:languages,id', 'description' => 'required|string|max:20000',
            'tags' => 'nullable|array|max:20', 'tags.*' => 'nullable|string|max:50', 'publication_year' => 'nullable|integer|between:1000,2100', 'publisher' => 'nullable|string|max:250', 'isbn' => 'nullable|string|max:32',
            'rights_status' => 'required|in:unverified,owned,licensed,public_domain', 'rights_evidence' => 'nullable|string|max:10000', 'confirm_rights' => 'nullable|boolean',
            'read_available' => 'required|boolean', 'download_available' => 'required|boolean', 'download_price_paise' => 'required|integer|between:100,10000000', 'status' => 'required|in:draft,published', 'category_ids' => 'required|array|max:10', 'category_ids.*' => 'exists:categories,id',
            'pdf' => 'nullable|file|mimetypes:application/pdf|max:51200', 'cover' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:5120',
        ]);
        if ($r->hasFile('pdf')) {
            abort_unless(str_starts_with(file_get_contents($r->file('pdf')->getRealPath(), false, null, 0, 5), '%PDF-'), 422, 'Invalid PDF header.');
        }
        if ($data['status'] === 'published') {
            abort_unless(($data['confirm_rights'] ?? false) && $data['rights_status'] !== 'unverified' && ! empty($data['rights_evidence']), 422, 'Confirm publication and distribution rights and record evidence.');
            abort_unless($r->hasFile('pdf') || ($book->exists && $book->files()->where('kind', 'pdf')->exists()), 422, 'Upload a PDF before publishing.');
        }
        $data['tags'] = array_values(array_filter($data['tags'] ?? [], fn ($v) => is_string($v) && $v !== ''));
        $categories = $data['category_ids'];
        unset($data['category_ids'],$data['confirm_rights'],$data['pdf'],$data['cover']);
        $new = [];
        $old = [];
        try {
            foreach (['pdf', 'cover'] as $kind) {
                if ($r->hasFile($kind)) {
                    $f = $r->file($kind);
                    $disk = config('readduniya.disk');
                    $path = $f->storeAs('books/'.Str::uuid(), $kind.'.'.$f->extension(), $disk);
                    throw_if(! $path, \RuntimeException::class, 'File storage failed.');
                    $new[$kind] = ['disk' => $disk, 'path' => $path, 'mime' => $f->getMimeType(), 'size' => $f->getSize(), 'sha256' => hash_file('sha256', $f->getRealPath())];
                }
            }
            DB::transaction(function () use ($book, $data, $categories, $new, &$old, $r) {
                $book->fill($data);
                if ($r->boolean('confirm_rights')) {
                    $book->rights_confirmed_by = $r->user()->id;
                    $book->rights_confirmed_at = now();
                } else {
                    $book->rights_confirmed_by = null;
                    $book->rights_confirmed_at = null;
                }
                if (isset($new['pdf'])) {
                    $book->render_status = 'pending';
                    $book->page_count = 0;
                    $book->render_error = null;
                }
                $book->save();
                $book->categories()->sync($categories);
                foreach ($new as $kind => $file) {
                    $prior = $book->files()->where('kind', $kind)->first();
                    if ($prior) {
                        $old[] = $prior->getAttributes();
                    }
                    $book->files()->updateOrCreate(['kind' => $kind], $file);
                }
            });
        } catch (\Throwable $e) {
            foreach ($new as $f) {
                Storage::disk($f['disk'])->delete($f['path']);
            } throw $e;
        }
        foreach ($old as $f) {
            Storage::disk($f['disk'])->delete($f['path']);
        }
        if (isset($new['pdf'])) {
            RenderBook::dispatch($book->id, $new['pdf']['sha256']);
        }

        return response()->json($book->load(['author', 'language', 'categories', 'files']), $book->wasRecentlyCreated ? 201 : 200);
    }

    public function destroy(Book $book)
    {
        // Retire purchased books so purchase/audit records remain valid.
        if (Order::where('book_id', $book->id)->exists()) {
            $book->update(['status' => 'draft']);

            return response()->json(['message' => 'Book retired; purchase records retained.']);
        }
        $files = $book->files;
        $book->delete();
        foreach ($files as $f) {
            Storage::disk($f->disk)->delete($f->path);
        }
        Storage::disk(config('readduniya.disk'))->deleteDirectory('pages/'.$book->id);

        return response()->noContent();
    }

    public function retry(Book $book)
    {
        $f = $book->files()->where('kind', 'pdf')->firstOrFail();
        $book->update(['render_status' => 'pending']);
        RenderBook::dispatch($book->id, $f->sha256);

        return ['queued' => true];
    }

    public function summary()
    {
        return ['books' => Book::count(), 'readers' => User::where('role', 'reader')->count(), 'revenue_paise' => (int) Order::where('status', 'paid')->sum('amount_paise'), 'paid_orders' => Order::where('status', 'paid')->count(), 'sales' => Order::where('status', 'paid')->selectRaw('DATE(updated_at) as date, SUM(amount_paise) as total')->groupByRaw('DATE(updated_at)')->orderBy('date')->limit(90)->get()];
    }

    public function orders(Request $r)
    {
        $r->validate(['status' => 'nullable|in:creating,pending,paid,failed,expired,refunded']);

        return Order::with(['book', 'payments'])->when($r->status, fn ($q) => $q->where('status', $r->status))->latest()->paginate(20);
    }

    public function users(Request $r)
    {
        $r->validate(['q' => 'nullable|string|max:100']);

        return User::when($r->q, fn ($q) => $q->where('email', 'like', '%'.$r->q.'%'))->latest()->paginate(20);
    }

    public function role(Request $r, User $user)
    {
        $d = $r->validate(['role' => 'required|in:reader,admin']);
        abort_if($user->id === $r->user()->id, 422, 'Cannot change your own role.');
        $user->forceFill($d)->save();

        return $user;
    }

    private function taxonomyClass(string $type): string
    {
        return match ($type) {
            'authors' => Author::class,'categories' => Category::class,'languages' => Language::class,default => abort(404)
        };
    }

    public function taxonomy(Request $r, string $type, ?int $id = null)
    {
        $class = $this->taxonomyClass($type);
        $record = $id ? $class::findOrFail($id) : new $class;
        $table = $record->getTable();
        $rules = ['name' => ['required', 'string', 'max:100', Rule::unique($table)->ignore($id)]];
        if ($type === 'authors') {
            $rules['bio'] = 'nullable|string|max:2000';
        }
        if ($type === 'categories') {
            $rules['slug'] = ['required', 'alpha_dash', 'max:100', Rule::unique($table)->ignore($id)];
        }
        if ($type === 'languages') {
            $rules['code'] = ['required', 'alpha_dash', 'max:8', Rule::unique($table)->ignore($id)];
        }
        $record->fill($r->validate($rules))->save();

        return response()->json($record, $id ? 200 : 201);
    }

    public function deleteTaxonomy(string $type, int $id)
    {
        $class = $this->taxonomyClass($type);
        $record = $class::findOrFail($id);
        $used = match ($type) {
            'authors' => Book::where('author_id', $id)->exists(),'languages' => Book::where('language_id', $id)->exists(),'categories' => DB::table('book_category')->where('category_id', $id)->exists()
        };
        abort_if($used, 409, 'Reassign associated books before deleting this entry.');
        $record->delete();

        return response()->noContent();
    }

    public function settings(Request $r)
    {
        $d = $r->validate(['announcement' => 'nullable|string|max:250', 'contact_email' => 'required|email|max:254']);
        foreach ($d as $k => $v) {
            Setting::updateOrCreate(['key' => $k], ['value' => $v ?? '']);
        }

        return ['saved' => true];
    }
}
