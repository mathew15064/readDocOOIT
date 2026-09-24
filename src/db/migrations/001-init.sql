-- 001-init.sql

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_ext TEXT,
  file_size INTEGER,
  mtime TEXT,
  version_num INTEGER,
  version_date TEXT,
  module_path TEXT,
  doc_type TEXT,
  base_name TEXT,
  is_latest INTEGER DEFAULT 1,
  indexed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_documents_name ON documents(file_name);
CREATE INDEX IF NOT EXISTS idx_documents_module ON documents(module_path);
CREATE INDEX IF NOT EXISTS idx_documents_version ON documents(version_num);
CREATE INDEX IF NOT EXISTS idx_documents_base_latest ON documents(base_name, is_latest);

-- Bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(document_id),
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Scan logs table
CREATE TABLE IF NOT EXISTS scan_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  files_found INTEGER,
  files_indexed INTEGER,
  errors TEXT
);
