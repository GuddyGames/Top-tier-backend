const { Pool } = require('pg');
require('dotenv').config();

// Supabase (and most managed Postgres hosts) require SSL on external
// connections. Set DB_SSL=true in .env when pointing at Supabase;
// leave it unset for a local Postgres install with no SSL configured.
const sslConfig = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

// Keep one shared, deliberately small pool for the whole API.
// A small pool is safer on Render/Supabase because each process can otherwise
// consume too many database connections. pg also queues requests when all
// clients are busy instead of creating unlimited connections.
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: sslConfig,
        max: Number(process.env.PG_POOL_MAX) || 5,
        idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS) || 30000,
        connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS) || 10000,
        maxUses: Number(process.env.PG_MAX_USES) || 1000,
      }
    : {
        host: process.env.PGHOST,
        port: process.env.PGPORT,
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        ssl: sslConfig,
        max: Number(process.env.PG_POOL_MAX) || 5,
        idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS) || 30000,
        connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS) || 10000,
        maxUses: Number(process.env.PG_MAX_USES) || 1000,
      }
);

// Prevent an idle-client database error from crashing the Node process.
pool.on('error', (err) => {
  console.error('[db] Unexpected PostgreSQL idle-client error:', err.message);
});

// Log pool-level diagnostics without exposing DATABASE_URL/passwords.
pool.on('connect', () => {
  console.log('[db] PostgreSQL connection established');
});

// Reuse the pool everywhere. Do not create pg.Client/Pool instances per request.
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
