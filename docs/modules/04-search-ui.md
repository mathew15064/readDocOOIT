# Module: Search UI
## Purpose
Alpine.js driven search, filter, responsive document table, version history modal, and document tags management.

## Public API
N/A (Frontend)

## Dependencies
TailwindCSS CDN, Alpine.js CDN, `public/js/toast.js`

## Endpoints
- `GET /api/documents?q=&module=&only_latest=&page=&pageSize=&tagIds=`
- `GET /api/documents/:id/versions?currentId=`
- `POST /api/documents/:id/reveal`
- `GET /api/tags`
- `GET /api/documents/:id/tags`
- `PUT /api/documents/:id/tags`
- `POST /api/documents/:id/tags/:tagId`
- `DELETE /api/documents/:id/tags/:tagId`
- `GET /api/documents/:id/preview` (Parse text/csv/xlsx or return metadata)
- `GET /api/documents/:id/raw` (Stream file inline for PDF/images)

## Responsive Layout & Scrollbar Structure (Task 5.1)
- `html, body`: `overflow: hidden; height: 100%; margin: 0; padding: 0;`.
- Only ONE scrollable area per view: the documents table body and the bookmark sidebar list.
- Custom thin scrollbar (`.scrollbar-thin`) styled for dark theme (`scrollbar-width: thin; scrollbar-color: #334155 transparent;` for Firefox; `::-webkit-scrollbar` 8px with `#334155` thumb).
- Table layout: `table-fixed w-full` with cell truncation prevents unwanted horizontal scrollbars.
- Column visibility:
  - `EXT`: visible on `≥ 640px` (`hidden sm:table-cell`).
  - `TAGS`: visible on `≥ 1024px` (`hidden lg:table-cell`). Shows up to 3 colored pills + `+N` badge. Clicking pill filters documents by tag.
  - `MODULE`: visible on `≥ 1280px` (`hidden xl:table-cell`).

## Drag & Drop Tags onto Documents (Task 5.2)
- Draggable tag pills in sidebar collapsible section (`draggable="true"`, `data-tag-id`).
- Drop targets on document table rows (`dragover`, `dragleave`, `drop`).
- Visual feedback: row highlight (`ring-2 ring-indigo-500` or tag color outline via `box-shadow`), grab/grabbing cursor.
- Duplicate prevention: notifies if tag is already applied on document.
- Updates tags in-place via existing `POST /api/documents/:id/tags/:tagId`.

## Right-Click Context Menu (Task 5.3)
- Reusable `public/js/context-menu.js` exposed as `window.ContextMenu`.
- Features: auto-positioning, viewport-boundary flip detection (auto-flip if near right or bottom edge), closes on outside click, scroll, or Escape.
- Document row menu: Open, Reveal in folder, Preview in browser, Bookmark, Version history, Copy file path, Copy file name, Manage tags.
- Bookmark item menu: Open, Reveal, Preview in browser, Version history, Copy file path, Update to latest (if outdated), Remove from group.
- Tag pill menu: Rename, Change color, Copy tag name, Delete tag.

## In-Browser Web File Preview (Task 5.5)
- Preview modal rendering file contents inside browser without requiring external desktop apps:
  - `.xlsx`, `.xls`: Parsed via `exceljs`, multi-sheet tabs, first 500 rows per sheet in sticky-header HTML table.
  - `.csv`: Parsed comma-separated rows into interactive HTML table (limit 500 rows).
  - `.pdf`: Rendered via `<iframe>` pointing to `/api/documents/:id/raw`.
  - Images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`): Rendered via `<img>` pointing to `/api/documents/:id/raw`.
  - Text (`.txt`, `.md`, `.log`): Rendered with styled `<pre>` up to 500KB.
  - Fallback: Graceful message with Open and Reveal buttons for unsupported types.
- Payload limit: Files over 15MB return `413 PAYLOAD_TOO_LARGE`.
- Safe paths: All file accesses enforced within `DOC_ROOT_DIR` via path traversal guard.
- Escape key or close button closes modal; backdrop click does not close (ADR-020).

## Version History Modal
- Triggered by clicking document filename in the table or bookmark item in the sidebar.
- Fetches all sibling versions of the logical document (same `base_name` + `module_path`) sorted by `version_date DESC, version_num DESC`.
- Highlights:
  - `[LATEST]`: green badge.
  - `[CURRENT ← bookmarked]`: blue badge with left-border accent.
  - `[OLDEST]`: gray badge.
- Inline actions: Open, Reveal in folder, Bookmark (disabled if already bookmarked).
- Tags section with interactive tag pills and popover for toggling/creating tags.
- Complies with ADR-009 / ADR-020 (never closes on backdrop click).

## Reveal in Folder
- `POST /api/documents/:id/reveal` executes platform-specific command to reveal the file in explorer/finder with path traversal guards.

