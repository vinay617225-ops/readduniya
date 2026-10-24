<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BookFile extends Model
{
    protected $guarded = [];

    protected $hidden = ['path', 'disk', 'sha256'];
}
