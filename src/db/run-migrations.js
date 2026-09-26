// src/db/run-migrations.js
const fs = require('fs');
const path = require('path');

/**
 * Applies any pending .sql files from `migrationsDir` to `db`, tracking what
 * has already run in a `schema_migrations` table so each file executes at
 * most once. Previously every file ran on every server start; that only
 * worked because each migration happened to be idempotent (CREATE TABLE IF
 * NOT EXISTS, etc.) — the first non-idempotent migration (e.g. ALTER TABLE
 * ADD COLUMN) would otherwise fail on the second boot.
 */
function runMigrations(db, migrationsDir) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  if (!fs.existsSync(migrationsDir)) return [];

  const applied = new Set(
    db.prepare('SELECT filename FROM schema_migrations').all().map((r) => r.filename)
  );
  const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  const newlyApplied = [];

  for (const file of migrationFiles) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const applyOne = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (filename) VALUES (?)').run(file);
    });
    applyOne();
    newlyApplied.push(file);
  }

  return newlyApplied;
}

module.exports = { runMigrations };
