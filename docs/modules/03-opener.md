# Module: Opener
## Purpose
Opens indexed documents safely using the OS default application via `child_process.spawn`.

## Public API
`openFile(filePath, env)`

## Dependencies
`child_process.spawn`, `src/config/env.js`, `fs.promises`

## Endpoints
- `POST /api/open-file` Body: `{ filePath: string }`
  - Success: `200` + `{ opened: true, filePath: string }`
  - Errors: `400` (missing filePath), `403` (PATH_OUTSIDE_ROOT), `404` (NOT_A_FILE / ENOENT), `500` (other errors)
- `POST /api/documents/:id/open`
  - Looks up document by id in SQLite and calls `openFile(doc.file_path, env)`

## Security & ADRs
- ADR-002: Open files via OS default application (`cmd /c start ''` on Windows, `open` on macOS, `xdg-open` on Linux). Never `exec`.
- ADR-005: Path Traversal Guard: compare `path.relative` within the configured root, both lexically and after `realpath`, to reject sibling-prefix and symlink escapes with `PATH_OUTSIDE_ROOT`.
- WSL: pass paths to `wslpath` via async `execFile` argument arrays (never interpolate document names into a shell command). The app is local-only; the HTTP server binds `127.0.0.1`.

## Edge Cases
- Path outside root directory (`PATH_OUTSIDE_ROOT`).
- Target is a directory instead of a regular file (`NOT_A_FILE`).
- Target file does not exist (`ENOENT`).

## Tests
- Unit tests: verify PATH_OUTSIDE_ROOT, ENOENT, NOT_A_FILE, and spawn args mocking per platform.
- Integration tests: verify `/api/open-file` status codes (400, 403, 200).
