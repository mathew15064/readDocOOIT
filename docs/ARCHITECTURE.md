# 🏗️ System Architecture & ADRs — Doc Reader

## Overview
```
[ Browser / Alpine.js UI ]
            │ HTTP
            ▼
[ Express Server ] ── (Logger, Error handler, Validation)
      │                │
      ▼                ▼
      ├──> [ SQLite (better-sqlite3) ] (documents, bookmarks, scan_logs)
      │
      └──> [ child_process.spawn ] ──> [ Excel | LibreOffice | OS default ]
                    │
                    ▼
           [ Local File System — DOC_ROOT_DIR ]
```

## Module Boundaries
- `src/modules/scanner/` — recursive folder walk + DB upsert
- `src/modules/parser/` — filename → { version_num, version_date, doc_type }
- `src/modules/opener/` — spawn OS default application
- `src/modules/documents/` — search, list, get detail
- `src/modules/bookmarks/` — CRUD

## ADRs
- **ADR-001: Local File Indexing Instead of Upload**: Store absolute paths in SQLite; never upload file contents.
- **ADR-002: Open files via OS default application**: Use OS default application associations via `child_process.spawn` (never `exec`). Rationale: User only needs one way to open files without selecting an application.
- **ADR-003: Regex-Based Version Parser**: Regex `/_V(\d+)_(\d{8})/`. Store `version_num` (INT) and `version_date` (TEXT YYYY-MM-DD).
- **ADR-004: `is_latest` Computed at Scan Time**: Group by `(module_path, base_name_without_version)`. Mark only the highest `version_num` + newest `version_date` as `is_latest=1`.
- **ADR-005: Path Traversal Guard**: Reject any `path.resolve(filePath)` that does not start with `path.resolve(DOC_ROOT_DIR)`.
- **ADR-006: Toast Notifications over Browser Alerts**: Standalone `public/js/toast.js` with stacking, auto-dismiss, and type-based colors.
- **ADR-007: SSE for Scan Progress**: `POST /api/scan` returns `scan_id` immediately. Progress is streamed via `GET /api/scan/:id/stream`.
- **ADR-008: Client-Side Search on Small Datasets**: Load all documents once, filter client-side with Alpine.js computed properties.
- **ADR-009: Modals Never Close on Backdrop Click**: Only close via X / Cancel / Escape / form submit.
- **ADR-010: Git Pull via `spawn`, Not `exec`**: Use `spawn('git', ['pull'], { cwd: DOC_GIT_REPO })`.
- **ADR-011: Bookmark Groups with Color Coding**: Upgrade flat bookmarks to 2 relational tables (`bookmark_groups` + `bookmark_items`) with name, color, and description. UI provides an accordion sidebar and an "Add to Bookmark" modal to pick or create groups. Foreign key cascade delete ensures clean data lifecycle.
- **ADR-012: Outdated Bookmark Detection**:
  - Context: Users bookmark files that later become outdated when a newer version is committed. They have no signal that a newer version exists.
  - Decision: At bookmark-listing time, join with the latest sibling document (same `base_name` + `module_path`, `is_latest = 1`). If the bookmarked doc is not the latest, expose `is_outdated` + `latest_sibling` in the API. UI shows warning badges + "Update to latest" button.
  - Consequence: Bookmark stays valid (still opens the old file) but user is aware and can choose to update. No automatic migration to avoid surprising the user.
- **ADR-013: Document Tags Relational Schema**:
  - Context: Documents require customizable labels/tags for categorization and cross-cutting search.
  - Decision: Create `tags` table (`id`, `name`, `color`, `created_at`) and `document_tags` join table (`document_id`, `tag_id`, `created_at`) with `ON DELETE CASCADE` foreign keys. Document search supports `?tagIds=1,2,3` using SQL OR logic (`id IN (SELECT document_id FROM document_tags WHERE tag_id IN (...))`) and attaches `tags` array to documents.
- **ADR-014: Reveal in Folder via Platform Commands**:
  - Context: Users need to open the operating system file explorer highlighting or opening the document's folder.
  - Decision: Use detached `child_process.spawn` with platform-specific commands:
    - Windows: `explorer /select,"<resolvedPath>"` (ignore exit code 1 as explorer returns 1 on success).
    - macOS: `open -R "<resolvedPath>"`.
    - Linux: `xdg-open "<dirPath>"`.
    Strict path traversal validation ensures `resolvedPath` starts within `DOC_ROOT_DIR`.
- **ADR-015: In-Browser Web File Preview with Size Guard**:
  - Context: Users want to inspect document contents (Excel sheets, CSVs, PDFs, text, images) directly in the web app without launching desktop applications.
  - Decision: Provide `GET /api/documents/:id/preview` (for structured data) and `GET /api/documents/:id/raw` (for inline streaming with `Content-Disposition: inline`). Excel workbooks (`.xlsx`/`.xls`) are parsed via `exceljs` returning sheet tabs and rows (first 500 rows per sheet). Files > 15MB or text > 500KB are guarded with `413 PAYLOAD_TOO_LARGE`. All reads enforce path traversal checks within `DOC_ROOT_DIR`.
- **ADR-016: UI Interactions: Drag & Drop Tags and Context Menus**:
  - Context: Users need quick, accessible actions on documents and bookmarks without multiple modal steps or cluttered table button rows.
  - Decision:
    - HTML5 Drag and Drop API: Draggable tag pills transfer `application/x-tag-id` onto document table rows with drop zone styling (`ring-2 ring-indigo-500`), triggering tag association via `POST /api/documents/:id/tags/:tagId`.
    - Standalone Context Menu (`public/js/context-menu.js`): Single global listener renders lightweight absolute positioning menu with edge-boundary detection (auto-flipping near screen edges) and auto-dismiss on outside click or scroll.
- **ADR-020: Consistent Modal Dismissal Behavior**:
  - Context: Users accidentally clicking outside modals lose unsaved inputs or context.
  - Decision: Modals never dismiss on backdrop click; they only close via explicit X / Cancel / Close buttons or Escape key.

- **ADR-021: Claude Warm Editorial Design System**:
  - Context: Original dark theme (slate/#0b1020) was generic and hard to scan for long sessions. User requested a warm editorial look matching Anthropic's brand.
  - Decision: Adopt Claude design tokens — cream canvas (`#faf9f5`), coral primary (`#cc785c`), dark navy surfaces for code mockups, serif display headlines (Cormorant Garamond fallback), humanist sans body (Inter). Tailwind config inlined; custom scrollbar and font utilities in `public/css/claude.css`.
  - Consequence: Cleaner reading experience, warmer brand. No dark theme as default. All modals/buttons/pills use cream + coral palette.

- **ADR-022: Bookmark Groups with Color Coding**:
  - Context: Flat bookmarks were insufficient for grouping related documents (e.g., "Shipper base calendar" with 5+ files).
  - Decision: Two tables — `bookmark_groups` (name, color, description) and `bookmark_items` (group_id, document_id, note). UI uses accordion sidebar + "Add to Bookmark" modal.
  - Consequence: Schema more complex but UX far more flexible. Cascade delete cleans up automatically.

- **ADR-023: Document Tags**:
  - Context: Documents span multiple categories (spec, design, business, per-module) that don't fit a single hierarchy.
  - Decision: `tags` + `document_tags` many-to-many. Tag pills on each row, drag-and-drop to assign, filter by multi-tag.
  - Consequence: Flexible categorization without rigid folders.

- **ADR-024: Inline Web Preview for Office Documents**:
  - Context: Users wanted to inspect files without opening Excel/LibreOffice every time.
  - Decision: `/api/documents/:id/preview` returns parsed content — XLSX via `exceljs` (sheet tabs, 500-row cap), CSV/TXT/MD as text, PDF/images via `/raw` stream. Preview modal in browser.
  - Consequence: Fast inspection. Large files capped with clear message. Original files still open in native apps via the Open button.

- **ADR-025: OS Default Opener (no Excel/Libre option)**:
  - Context: Earlier versions asked the user to choose Excel vs LibreOffice per open. Redundant for a single-machine local app.
  - Decision: Single `Open` button uses the OS default handler (`cmd /c start` on Windows, `open` on macOS, `xdg-open` on Linux). No app-path config needed.
  - Consequence: `.env` shrinks to `DOC_ROOT_DIR` + `PORT`. Zero app-path maintenance.

- **ADR-026: Scanner Extension Whitelist**:
  - Context: Initial scanner indexed every file, including `.git/` internals and lock files (4136 null-version rows). Noisy and slow.
  - Decision: Whitelist Office docs (xlsx/xls/xlsm, docx/doc, pptx/ppt), PDF, text (csv/txt/md), diagrams (drawio/a5er/vsdx/vsd), images (png/jpg/jpeg/gif/svg/webp). Ignore `.git`, `node_modules`, `dist`, `build`, `coverage`, and any non-whitelisted extension.
  - Consequence: 9561 → ~7000 rows. Zero `.git` noise. `is_latest` computation now accurate.

- **ADR-027: Alpine.js `x-show` vs `x-if` for Null-Safe Rendering**:
  - Context: Bug — `x-text="item.latest_sibling.version_num"` inside an `x-show` block threw `Cannot read properties of null` when `latest_sibling` was null, because Alpine compiles children of `x-show` even when hidden.
  - Decision: Use `<template x-if="...">` for any subtree that depends on a possibly-null object, and use optional chaining (`?.`) everywhere null may propagate.
  - Consequence: No more runtime null crashes from hidden subtrees.


