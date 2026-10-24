<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    public function createApplication()
    {
        $app = parent::createApplication();
        $connection = $app['config']->get('database.default');
        $database = $app['config']->get('database.connections.'.$connection.'.database');
        if ($connection !== 'sqlite' && ! str_ends_with((string) $database, '_test')) {
            throw new \RuntimeException('Refusing destructive tests: SQL database name must end in _test. Use the Compose tests service or a disposable test database.');
        }
        if ($connection === 'sqlite' && $database !== ':memory:' && ! str_ends_with((string) $database, 'test.sqlite')) {
            throw new \RuntimeException('Refusing tests against a non-test SQLite database.');
        }

        return $app;
    }
}
