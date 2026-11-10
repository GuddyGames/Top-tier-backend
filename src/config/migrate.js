// Applies sql/schema.sql to the database configured in .env
// Run with: npm run migrate
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function migrate() {
  const schemaPath = path.join(__dirname, '..', '..', 'sql', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const parallaxSchemaPath = path.join(__dirname, '..', '..', 'sql', 'parallax.sql');
  const parallaxSchema = fs.readFileSync(parallaxSchemaPath, 'utf8');

  console.log('Applying schema.sql ...');
  try {
    await pool.query(schema);
    await pool.query(parallaxSchema);
    console.log('✔ Top-tier and Parallax schemas applied successfully.');
  } catch (err) {
    console.error('✘ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
