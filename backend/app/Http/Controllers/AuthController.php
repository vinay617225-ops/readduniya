<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $r)
    {
        $data = $r->validate(['name' => 'required|string|max:100', 'email' => 'required|email|max:254|unique:users', 'password' => ['required', 'confirmed', Password::min(12)->letters()->numbers()]]);
        $user = User::create($data)->refresh();
        Auth::login($user);
        $r->session()->regenerate();

        return response()->json($user, 201);
    }

    public function login(Request $r)
    {
        $data = $r->validate(['email' => 'required|email', 'password' => 'required|string']);
        if (! Auth::attempt($data)) {
            throw ValidationException::withMessages(['email' => 'The credentials do not match.']);
        }
        $r->session()->regenerate();

        return $r->user();
    }

    public function logout(Request $r)
    {
        Auth::guard('web')->logout();
        Auth::forgetGuards();
        $r->session()->invalidate();
        $r->session()->regenerateToken();

        return response()->noContent();
    }
}
