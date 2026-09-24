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
## Tests
Mock `fs.promises`, verify concurrency limit, verify ignore pattern filtering.
