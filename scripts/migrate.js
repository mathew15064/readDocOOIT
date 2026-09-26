// scripts/migrate.js
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { runMigrations } = require('../src/db/run-migrations');

// Ensure data directory exists
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'doc-reader.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON;');

const migrationsDir = path.resolve(__dirname, '../src/db/migrations');
const applied = runMigrations(db, migrationsDir);

if (applied.length === 0) {
  console.log('No pending migrations — database is up to date.');
} else {
  applied.forEach((file) => console.log(`Applied migration: ${file}`));
  console.log('All migrations applied successfully.');
}
