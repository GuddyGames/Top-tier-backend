const { Pool } = require('pg');
require('dotenv').config();

// Supabase (and most managed Postgres hosts) require SSL on external
// connections. Set DB_SSL=true in .env when pointing at Supabase;
// leave it unset for a local Postgres install with no SSL configured.
const sslConfig = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

// A single shared connection pool. Every query in the app should go
// through this — never open a new pg.Client() per request, that's
// what exhausts your database's connection limit under load.
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: sslConfig }
    : {
        host: process.env.PGHOST,
        port: process.env.PGPORT,
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        ssl: sslConfig,
      }
);

pool.on('error', (err) => {
  // Fires on idle client errors (e.g. DB restarted) — log, don't crash.
  console.error('Unexpected PostgreSQL error on idle client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
