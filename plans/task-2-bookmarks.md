# Plan: Task 2 - Bookmark Groups

## Scope & Objective
Replace flat bookmarks with group/category bookmarks. Multiple documents per group, color coding, note per item, accordion sidebar, "Add to Bookmark" modal, and "Manage Groups" modal.

## Database Migration
- `src/db/migrations/002-bookmark-groups.sql`:
  - Drop table `bookmarks`
  - Create `bookmark_groups`
  - Create `bookmark_items` with foreign keys and cascade delete
  - Indexes on `bookmark_items(group_id)` and `bookmark_items(document_id)`

## Service & Routes
- `src/modules/bookmarks/bookmarks.service.js`:
  - `listGroups`, `createGroup`, `updateGroup`, `deleteGroup`
  - `listGroupItems`, `addItemToGroup`, `removeItem`, `updateItemNote`, `getDocumentGroups`
  - Validations: name required (max 100 chars), color hex `#RRGGBB`, unique group name, unique `(group_id, document_id)`.
- `src/modules/bookmarks/bookmarks.routes.js`:
  - REST endpoints per specification with 201, 400, 404, 409 responses.
- `src/app.js`:
  - Mount bookmark routes.

## Frontend (public/index.html)
- Accordion sidebar with groups, color badges, file count, item list with open and delete actions.
- Document list row with 📌 indicator reflecting group association.
- Add to Bookmark modal (existing group vs new group, disabled if already member).
- Manage Group modal with HTML5 native color picker `<input type="color">`.
- Backdrop click protection on all modals.

## Tests & Docs
- Unit tests: `tests/unit/bookmarks.test.mjs`
- Integration tests: `tests/integration/bookmarks.test.mjs` (replace old `tests/integration/bookmark.test.js`)
- Update `docs/modules/05-bookmark.md`, `docs/ARCHITECTURE.md`, `docs/PROJECT_STATE.md`, `docs/LESSONS.md`.
