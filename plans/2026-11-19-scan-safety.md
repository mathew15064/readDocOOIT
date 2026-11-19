# 2026-11-19 — Data-safe scan and file-access boundaries

## Input / goal
Stabilize readDocOOIT for local use without changing the existing production database.

## Output
- Rescans update document metadata without replacing document IDs, bookmarks or tags.
- File open, reveal and preview enforce canonical containment within DOC_ROOT_DIR, including sibling-prefix and symlink cases.
- Rescan API refuses roots outside configured DOC_ROOT_DIR.
- WSL path conversion uses argument-safe, asynchronous commands instead of shell-evaluated execSync.
- Local-only server listens on loopback, not all network interfaces.
- Regressions have focused tests and existing unit/integration suite stays green.

## Edge cases / tests
- Re-scan an already-bookmarked/tagged document; ID and relations remain unchanged.
- Paths in sibling directories with similar prefixes, traversal and symlinks to outside are denied.
- A child scan folder inside DOC_ROOT_DIR remains allowed; unrelated root is rejected.
- Test only against disposable databases; no migration or rescan of real data.

## Files to change
src/modules/scanner/index.js, src/modules/opener/opener.service.js,
src/modules/preview/preview.service.js, src/routes/scan.js,
src/server.js, src/utils/path-guard.js, src/modules/opener/wsl-helper.js,
relevant tests and docs/PROJECT_STATE.md.

## Risks and exclusions
Existing stale document records are not deleted or migrated in this change.
No production data modifications or deployment. Use review PR for integration.
