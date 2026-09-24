# 📝 Lessons Learned — Doc Reader

- **UTF-8 & Spaces in Paths**: Document paths contain Japanese characters and spaces. Always use `path.join` and store as UTF-8 in SQLite.
- **Never use `child_process.exec`**: It blocks the Node event loop. Use `spawn` with `{ detached: true, stdio: 'ignore' }` and call `.unref()`.
- **Never use `fs.readdirSync` in request handlers**: Use `fs.promises.readdir` with `withFileTypes: true`.
- **Excel Path Varies**: `EXCEL.EXE` path differs across Office 2016 / 2019 / 365. Store in `.env`; do not hard-code.
- **LibreOffice Path Varies**: On Windows, `soffice.exe` is usually under `C:\Program Files\LibreOffice\program\`. On Linux, use `libreoffice` command.
- **Modals must not close on backdrop click**: Allowing outside-click dismissal causes data loss. Close only via X / Cancel / Escape / form submit.
- **Version regex must be anchored**: Use `/_V(\d+)_(\d{8})/` and take the LAST match if multiple.
- **Path traversal protection**: Always `path.resolve(filePath).startsWith(path.resolve(DOC_ROOT_DIR))` before opening.
- **No Excel/Libre option needed for local apps**: When running on a single machine, OS default opener is enough. Avoid adding unnecessary UI options.
- **SQLite Foreign Keys in better-sqlite3**: Always run `db.pragma('foreign_keys = ON;')` on connection startup to ensure `ON DELETE CASCADE` is enforced.
- **Outdated bookmark migration conflict**: When migrating an outdated bookmark item to its latest sibling, check for `UNIQUE(group_id, new_document_id)`. If the latest sibling already exists in the same group, delete the outdated item to prevent duplicate constraint violation and notify the user with `ALREADY_IN_GROUP`.
- **`sed -i` corrupts HTML class strings**: Bulk regex replaces like `s/bg-slate-900/bg-canvas/` can chain into broken class names (`bg-canvasslate-900`, `canvassition`) when run repeatedly. NEVER use `sed -i` for HTML/Tailwind edits — always edit specific lines manually.
- **Alpine.js `x-show` compiles children even when hidden**: Use `<template x-if>` for any subtree that reads a possibly-null object. Pair with optional chaining (`item.foo?.bar`). Otherwise the first render throws and the app halts silently.
- **Scanner must whitelist extensions, not blacklist**: Blacklisting only `.git` still lets `.json`, `.lock`, `.pack`, and hundreds of tool files slip through. Prefer an `ALLOWED_EXTENSIONS` Set and skip everything else.
- **WSL + Windows app path pitfall**: `soffice.exe` on Windows cannot open files that live under `/home/...` in WSL because `wslpath -w` returns a `\\wsl.localhost\...` UNC path that LibreOffice cannot resolve. Either move the document repo to `/mnt/d/...` or run the server natively on Windows. Do not try to convert paths — it will always fail for some apps.
- **Playwright is the only reliable UI verification**: An LLM cannot "visually verify" a UI. Use `playwright` headless + `page.on('pageerror')` to catch runtime errors. Unit tests alone cannot catch `Cannot read properties of null` at render time.

