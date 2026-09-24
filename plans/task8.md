# plans/task8.md

## Config file schema (with default flag)
```json
{
  "openers": [
    {
      "id": "libre",
      "label": "LibreOffice",
      "icon": "[L]",
      "platform": "win32",
      "command": "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      "args": ["{file}"],
      "pathStrategy": "windows",
      "default": true
    },
    {
      "id": "excel",
      "label": "Excel",
      "icon": "[E]",
      "platform": "win32",
      "command": "C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE",
      "args": ["{file}"],
      "pathStrategy": "windows"
    },
    {
      "id": "default",
      "label": "OS Default",
      "icon": "[>]",
      "platform": "any",
      "command": null,
      "args": [],
      "pathStrategy": "native",
      "default": true
    }
  ]
}
```
*Exactly one opener should have `"default": true`. If zero or more than one are marked, the loader will fall back to the first opener in the array and emit a warning.*

## WSL path handling strategy
- **Detection**: `process.platform === 'linux' && /microsoft/i.test(require('fs').readFileSync('/proc/version', 'utf8'))`.
- **`windows` strategy**:
  - If source path starts with `/mnt/<drive>/…` → convert via `wslpath -w`.
  - Otherwise (e.g., `/home/…` or `/root/…`) copy the file to a temporary location under `/mnt/c/temp/doc-reader/` and use the Windows path `C:\temp\doc-reader\<hash>-<safeBasename>`.
- **`native` strategy**: use the original Linux path unchanged.
- **Cleanup**: on server start, delete any temp files in `/mnt/c/temp/doc-reader/` older than 24 h.

## API endpoints
| Method | URL | Body | Description |
|--------|-----|------|-------------|
| **GET** | `/api/openers` | – | Returns list of openers filtered by the current platform (`process.platform`). |
| **POST** | `/api/documents/:id/open` | `{ "openerId": "<id>" }` (optional) | Opens the document with the specified opener. If omitted, uses the opener marked `default: true` (or first in the array). |

## Files to be added / modified
- `config/openers.json` – new JSON config.
- `src/config/openers.js` – loader + validation (fallback, default flag handling, schema checks).
- `src/modules/opener/opener.service.js` – new `openWith(filePath, opener, env)` helper that uses the args array *only* when spawning.
- `src/modules/opener/opener.routes.js` – adds GET `/api/openers`; updates POST `/api/documents/:id/open` to accept `openerId`.
- `src/modules/opener/wsl-helper.js` – detection, path conversion, temporary copy with hash‑based naming, cleanup.
- `public/index.html` – replace the single **Open** button with a split‑button UI (desktop) and mobile adaptation.
- `tests/unit/opener.test.mjs` – unit tests for config loader, WSL detection, path conversion, hash‑based temp naming, args‑array spawning with spaces.
- `tests/integration/opener.test.js` – integration tests for the new endpoints and error handling.
- `docs/modules/03-opener.md` – documentation of the new multi‑option opener, config schema, WSL handling, UI details.
- `docs/ARCHITECTURE.md` – new ADR “Multi‑Option File Opener with JSON Config (WSL‑aware)”.
- `docs/PROJECT_STATE.md` – add Phase 8 entry.
- `plans/task8.md` – this planning document.

## Risks & mitigations (updated)
- **Temp‑file leakage** – cleanup on server start removes files older than 24 h.
- **Path traversal in temp copy** – sanitize the basename, hash‑based filename ensures deterministic reuse.
- **Race condition when opening the same file quickly** – hash‑based naming means concurrent opens reuse the same temp file; spawning is done with detached child processes.
- **Args array rule** – **Never build a command string**; always call `spawn(command, argsArray, { detached:true, stdio:'ignore' })`. This prevents failures with spaces in paths.
- **Config missing / invalid** – loader falls back to a built‑in OS‑default opener (see `FALLBACK`). No crash on startup.
- **Multiple defaults** – loader logs a warning and selects the first opener.
- **WSL detection in unit tests** – tests mock `/proc/version` or inject an `isWSL` flag to avoid real filesystem access.

## Test plan (updated)
- **Unit**: config loader validates required fields, default flag handling, platform filtering, WSL detection, hash‑based temp naming, args‑array spawning with spaces.
- **Unit**: `wsl-helper.js` path conversion for both `/mnt/*` and `/home/*` scenarios.
- **Integration**: GET `/api/openers` returns correct list per platform.
- **Integration**: POST `/api/documents/:id/open` with various `openerId` values (including missing, invalid) behaves as expected.
- **E2E (Playwright)**: split‑button main click uses stored last opener; dropdown shows icons/labels; selection updates `localStorage` and opens correctly.

---

*All refinements have been incorporated into this plan.*
