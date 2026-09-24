# Plan: Task 3 - Outdated Bookmark Detection

## Objective
Detect when bookmarked documents have newer versions available (`is_latest = 0`), provide a visual warning, and allow users to open or update to the latest sibling document.

## Files to Modify/Create
- `src/modules/bookmarks/bookmarks.service.js`:
  - Enhance `listGroupItems(groupId)` to include `is_outdated` and `latest_sibling`.
  - Add `updateItemToLatest(itemId)` with validation and duplicate cleanup.
  - Add `countOutdated()`.
- `src/modules/bookmarks/bookmarks.routes.js`:
  - `POST /api/bookmark-items/:id/update-to-latest`
  - `GET /api/bookmark-items/outdated-count`
- `public/index.html`:
  - Sidebar header: outdated count badge and "Show only outdated" toggle.
  - Item view: ⚠️ icon, [Outdated] badge, newer sibling details, [Open Latest] and [Update] buttons.
  - Documents table: ⚠️ icon on rows where `doc.is_latest === 0`.
- `tests/unit/bookmarks.test.mjs`:
  - Unit tests for `is_outdated` detection, `latest_sibling` mapping, and `updateItemToLatest`.
- `tests/integration/bookmark.test.js`:
  - Integration tests for outdated count, outdated status in group list, and updating bookmark to latest.
- Docs:
  - `docs/modules/05-bookmark.md`, `docs/ARCHITECTURE.md` (ADR-012), `docs/PROJECT_STATE.md`, `docs/LESSONS.md`.
