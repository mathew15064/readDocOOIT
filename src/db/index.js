// src/db/index.js
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { runMigrations } = require('./run-migrations');

// Ensure data directory exists (used for production)
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;
if (process.env.NODE_ENV === 'test') {
  // In‑memory DB for unit tests – avoids read‑only file issues
  db = new Database(':memory:');
} else {
  const dbPath = path.join(dataDir, 'doc-reader.db');
  db = new Database(dbPath);
}

db.pragma('foreign_keys = ON;');

// Run any pending migrations (tracked in schema_migrations so each file runs once)
const migrationsDir = path.resolve(__dirname, 'migrations');
runMigrations(db, migrationsDir);

// Preserve original exec for raw SQL execution
const originalExec = db.exec.bind(db);
/**
 * Enhanced exec method to support optional parameter array for prepared statements.
 * If parameters are provided, the SQL is prepared and executed with those parameters.
 * This is primarily for test helpers that use db.exec(sql, [params]).
 */
function execWithParams(sql, params) {
  if (Array.isArray(params) && params.length > 0) {
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  } else {
    return originalExec(sql);
  }
}
// Override db.exec with the enhanced version
db.exec = execWithParams;

module.exports = db;
