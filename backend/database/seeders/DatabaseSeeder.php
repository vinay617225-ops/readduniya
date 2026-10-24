<?php

namespace Database\Seeders;

use App\Jobs\RenderBook;
use App\Models\Author;
use App\Models\Book;
use App\Models\Category;
use App\Models\Language;
use App\Models\Setting;
use App\Models\User;
use App\Services\SamplePdf;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $curator = User::firstOrCreate(['email' => 'curator@example.invalid'], ['name' => 'ReadDuniya sample curator', 'password' => bin2hex(random_bytes(32))]);
        $en = Language::firstOrCreate(['code' => 'en'], ['name' => 'English']);
        $hi = Language::firstOrCreate(['code' => 'hi'], ['name' => 'हिन्दी']);
        $author = Author::firstOrCreate(['name' => 'ReadDuniya Studio'], ['bio' => 'Synthetic demonstration stories created for this project.']);
        foreach (['Fiction', 'Poetry', 'Philosophy', 'History', 'Personal Growth', 'Science'] as $name) {
            Category::firstOrCreate(['name' => $name], ['slug' => Str::slug($name)]);
        }
        $titles = [['The Art of Beginning', 'the-art-of-beginning', 'Personal Growth', $en], ['बारिश के बाद', 'baarish-ke-baad', 'Poetry', $hi], ['A Map of Small Wonders', 'a-map-of-small-wonders', 'Fiction', $en], ['मन के उस पार', 'mann-ke-us-paar', 'Philosophy', $hi], ['Letters to Tomorrow', 'letters-to-tomorrow', 'Fiction', $en], ['आसमान की कहानियाँ', 'aasman-ki-kahaniyan', 'Science', $hi], ['The Quiet Observatory', 'the-quiet-observatory', 'Science', $en], ['रास्तों की यादें', 'raaston-ki-yaadein', 'History', $hi]];
        foreach ($titles as $i => [$title,$slug,$category,$lang]) {
            $b = Book::firstOrCreate(['slug' => $slug], ['title' => $title, 'author_id' => $author->id, 'language_id' => $lang->id, 'description' => 'A synthetic catalogue placeholder from ReadDuniya Studio. Discover thoughtful ideas and a new perspective. This is demonstration metadata, not a published full book. Upload a rights-cleared PDF to enable reading and downloads.', 'tags' => ['sample', 'original'], 'publication_year' => 2026, 'publisher' => 'ReadDuniya Studio', 'rights_status' => 'owned', 'rights_evidence' => 'Synthetic metadata authored for this repository. No third-party book content.', 'rights_confirmed_by' => $curator->id, 'rights_confirmed_at' => now(), 'status' => 'published', 'read_available' => false, 'download_available' => false, 'download_price_paise' => $i % 2 ? 1000 : 2000]);
            if ($i === 0 && ! $b->files()->where('kind', 'pdf')->exists()) {
                $pdf = SamplePdf::bytes();
                $path = 'samples/'.$b->id.'/original.pdf';
                $disk = config('readduniya.disk');
                Storage::disk($disk)->put($path, $pdf, ['visibility' => 'private']);
                $b->files()->create(['kind' => 'pdf', 'disk' => $disk, 'path' => $path, 'mime' => 'application/pdf', 'size' => strlen($pdf), 'sha256' => hash('sha256', $pdf)]);
                $b->update(['read_available' => true, 'download_available' => true]);
                RenderBook::dispatch($b->id, hash('sha256', $pdf));
            }
            $b->categories()->syncWithoutDetaching([Category::where('name', $category)->first()->id]);
        }
        Setting::firstOrCreate(['key' => 'announcement'], ['value' => 'A little reading. A whole new world.']);
        Setting::firstOrCreate(['key' => 'contact_email'], ['value' => 'hello@readduniya.in']);
    }
}
