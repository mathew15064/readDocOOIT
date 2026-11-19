# Module: Scanner
## Purpose
Recursive folder walk + DB upsert honoring ignore patterns.
## Public API
`scanDirectory(rootDir, ignorePatterns)`
## Dependencies
`fs.promises`, `p-limit`, `src/db/index.js`, `SCAN_IGNORE_PATTERNS`
## Endpoints
`POST /api/scan`, `GET /api/scan/:id/status`, `GET /api/scan/:id/stream`
## Edge Cases
Symlinks, deeply nested folders, permission denied, interrupted scans.
## Data safety
Use SQLite `INSERT ... ON CONFLICT(file_path) DO UPDATE`, not `INSERT OR REPLACE`: replacing a document row changes its ID and cascades deletion of bookmark/tag associations. Do not automatically delete stale document records until a separate backup-safe reconciliation process exists. The scan API only accepts directories within the configured `DOC_ROOT_DIR` (canonical path check).

## Tests
Verify filename indexing, ignored extensions, and rescanning preserves document IDs and bookmark/tag relationships. Test API rejection of outside/symlink scan roots.
