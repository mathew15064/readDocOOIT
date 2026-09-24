-- 002-bookmark-groups.sql

-- Drop old bookmarks table (old data no longer used)
DROP TABLE IF EXISTS bookmarks;

-- Groups: e.g. "Shipper base calendar", "Booth Design"
CREATE TABLE IF NOT EXISTS bookmark_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Items: files belonging to a group
CREATE TABLE IF NOT EXISTS bookmark_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES bookmark_groups(id) ON DELETE CASCADE,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  note TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(group_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmark_items_group ON bookmark_items(group_id);
CREATE INDEX IF NOT EXISTS idx_bookmark_items_doc ON bookmark_items(document_id);
