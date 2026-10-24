<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Book extends Model
{
    protected $guarded = [];

    protected $hidden = ['rights_evidence', 'render_error'];

    protected function casts(): array
    {
        return ['tags' => 'array', 'read_available' => 'boolean', 'download_available' => 'boolean', 'rights_confirmed_at' => 'datetime'];
    }

    public function author()
    {
        return $this->belongsTo(Author::class);
    }

    public function language()
    {
        return $this->belongsTo(Language::class);
    }

    public function categories()
    {
        return $this->belongsToMany(Category::class);
    }

    public function files()
    {
        return $this->hasMany(BookFile::class);
    }

    public function scopePublished($q)
    {
        return $q->withExists(['files as has_cover' => fn ($q) => $q->where('kind', 'cover')])->where('status', 'published')->whereIn('rights_status', ['owned', 'licensed', 'public_domain'])->whereNotNull('rights_confirmed_at')->whereNotNull('rights_confirmed_by');
    }

    public function isAuthorized(): bool
    {
        return $this->status === 'published' && $this->rights_status !== 'unverified' && $this->rights_confirmed_at && $this->rights_confirmed_by;
    }
}
