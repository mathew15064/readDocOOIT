# Module: Git Sync

## Purpose
Synchronize the configured document repository and refresh the index **only when new commits arrive**.

## Endpoint
`POST /api/sync` returns:
- `{status: "ok", changed: false, scanStatus: "skipped", output: "..."}` when Git is already current (no expensive scan).
- `{status: "ok", changed: true, scanStatus: "completed", filesIndexed, output}` after a successful fast-forward pull and scan.
- `{status: "partial", changed: true, scanStatus: "completed_with_errors", errors, filesIndexed, output}` if Git updated but indexing had file errors.
- HTTP 500 with an error message if Git fails.

## Safety
- Pulls only with `git pull --ff-only` so divergent branches or local commits are not silently rebased/merged.
- Uses `GIT_TERMINAL_PROMPT=0` and a 60-second Git command timeout so the HTTP request cannot hang on interactive authentication.
- Concurrent sync requests share the same in-flight operation.
- Preserves bookmark/tag links during scan through the scanner's SQLite upsert.
- Does not delete stale database records. No real-data migration or cleanup.
- Document repository is configured by `DOC_ROOT_DIR`, not the application source Git repository.

## Tests
- Isolated local bare Git remote, clone, no-op sync, new commit, pull and index, repeated no-op sync.
