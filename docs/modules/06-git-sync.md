# Module: Git Sync
## Purpose
Triggers local Git repository sync (`git pull`) and auto-rescans document directory.

## Public API
`gitPull(repoDir)`

## Dependencies
`child_process.spawn`, `src/config/env.js`, `src/modules/scanner`

## Endpoints
`POST /api/sync`

## Security & ADRs
- ADR-010: Git Pull via `spawn`, Not `exec`: `spawn('git', ['pull'], { cwd: DOC_GIT_REPO })`.

## Edge Cases
- Non-git directory or git not installed.
- Network error during pull.

## Tests
- Mock `spawn` for `git pull`.
- Verify auto-rescan triggering.
