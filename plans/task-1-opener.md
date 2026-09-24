# Plan: Task 1 - Simplify Opener (OS default only)

## Scope & Objective
Remove multi-app opener (Excel/LibreOffice) and WSL path conversion. Use OS default opener (`openFile(filePath, env)`). Support `POST /api/open-file` and `POST /api/documents/:id/open`. Update UI to a single Open button.

## Files to Modify/Create
- `.env` and `.env.example`: Keep only `DOC_ROOT_DIR` and `PORT`.
- `src/config/env.js`: Only validate `DOC_ROOT_DIR` and `PORT` (number).
- `src/modules/opener/opener.service.js`: Rewrite to use OS default `spawn` per spec.
- `src/modules/opener/opener.routes.js`: Implement `POST /api/open-file` and `POST /api/documents/:id/open` with 400, 403, 404, 500 status codes.
- `src/modules/opener/index.js` (or routes export): Expose service and routes.
- `src/routes/open.js`: Delegate to or re-export `opener.routes.js`.
- `src/app.js`: Ensure routes mounted correctly.
- `public/index.html`: Remove Excel/Libre buttons; single Open button calling `POST /api/documents/:id/open`.
- `tests/unit/opener.test.mjs`: Unit test `openFile` error handling (PATH_OUTSIDE_ROOT, ENOENT, NOT_A_FILE, spawn mocking).
- Integration test for `POST /api/open-file` (400, 403, 200).
- Docs: `docs/modules/03-opener.md`, `docs/ARCHITECTURE.md`, `docs/LESSONS.md`, `docs/PROJECT_STATE.md`.

## Edge Cases
- Missing `filePath` (400)
- Path outside root (403, PATH_OUTSIDE_ROOT)
- Path is a directory (404, NOT_A_FILE)
- Path does not exist (404, ENOENT)
- Spawn command mocking across platform (win32: `cmd /c start '' resolved`, darwin: `open resolved`, linux: `xdg-open resolved`).
