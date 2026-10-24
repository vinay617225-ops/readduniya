<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReadingProgress extends Model
{
    protected $table = 'reading_progress';

    protected $guarded = [];

    public function book()
    {
        return $this->belongsTo(Book::class);
    }
}
