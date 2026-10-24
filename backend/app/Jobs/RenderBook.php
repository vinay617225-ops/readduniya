<?php

namespace App\Jobs;

use App\Models\Book;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;

class RenderBook implements ShouldQueue
{
    use Queueable;

    public $timeout = 600;

    public $tries = 2;

    public function __construct(public int $bookId, public string $hash) {}

    public function handle(): void
    {
        $book = Book::find($this->bookId);
        if (! $book) {
            return;
        }
        $f = $book->files()->where('kind', 'pdf')->where('sha256', $this->hash)->first();
        if (! $f) {
            return;
        }
        $book->update(['render_status' => 'processing']);
        $dir = storage_path('app/render-'.bin2hex(random_bytes(12)));
        mkdir($dir, 0700, true);
        try {
            $in = fopen($dir.'/input.pdf', 'wb');
            $src = Storage::disk($f->disk)->readStream($f->path);
            if (! $src) {
                throw new \RuntimeException('Source unavailable');
            } stream_copy_to_stream($src, $in);
            fclose($src);
            fclose($in);
            $info = new Process(['pdfinfo', $dir.'/input.pdf']);
            $info->setTimeout(30);
            $info->mustRun();
            preg_match('/^Pages:\s+(\d+)/m', $info->getOutput(), $m);
            $count = (int) ($m[1] ?? 0);
            if ($count < 1 || $count > config('readduniya.max_pages') || preg_match('/^Encrypted:\s+yes/m', $info->getOutput())) {
                throw new \RuntimeException('Unsupported page count or encrypted PDF');
            }
            $process = new Process(['pdftoppm', '-jpeg', '-jpegopt', 'quality=82', '-scale-to', '1800', '-f', '1', '-l', (string) $count, $dir.'/input.pdf', $dir.'/page']);
            $process->setTimeout(540);
            $process->mustRun();
            $textProcess = new Process(['pdftotext', '-layout', '-enc', 'UTF-8', $dir.'/input.pdf', $dir.'/text.txt']);
            $textProcess->setTimeout(60);
            $textProcess->mustRun();
            $textPages = explode("\f", file_get_contents($dir.'/text.txt'));
            $disk = Storage::disk($f->disk);
            for ($i = 1; $i <= $count; $i++) {
                $matches = glob($dir.'/page-'.str_pad((string) $i, strlen((string) $count), '0', STR_PAD_LEFT).'.jpg');
                if (! $matches) {
                    throw new \RuntimeException('Missing rendered page');
                }
                if (! $disk->put('pages/'.$book->id.'/'.$this->hash.'/'.$i.'.txt', trim($textPages[$i - 1] ?? ''), ['visibility' => 'private'])) {
                    throw new \RuntimeException('Text storage failed');
                }
                $stream = fopen($matches[0], 'rb');
                $ok = $disk->put('pages/'.$book->id.'/'.$this->hash.'/'.$i.'.jpg', $stream, ['visibility' => 'private']);
                fclose($stream);
                if (! $ok) {
                    throw new \RuntimeException('Page storage failed');
                }
            }
            if ($book->files()->where('kind', 'pdf')->where('sha256', $this->hash)->exists()) {
                $book->update(['render_status' => 'ready', 'page_count' => $count, 'render_error' => null]);
            }
        } finally {
            foreach (glob($dir.'/*') as $path) {
                unlink($path);
            } rmdir($dir);
        }
    }

    public function failed(?\Throwable $e): void
    {
        $b = Book::find($this->bookId);
        if ($b && $b->files()->where('kind', 'pdf')->where('sha256', $this->hash)->exists()) {
            $b->update(['render_status' => 'failed', 'render_error' => 'Rendering failed. Inspect restricted worker logs.']);
        }
    }
}
