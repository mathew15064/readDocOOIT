---
name: project-summary
description: Summarize the Doc Reader project (readDocOOIT) — what it does, how it is built, how data flows, and its current state/known issues. Use when asked to "summarize this project", "explain the codebase", onboard someone, or orient a fresh session before a task.
---

# Project Summary — Doc Reader

Produce an accurate, compact summary of this repository. Facts below are the
baseline; **verify anything you state against the code** (step 2) because docs
in `docs/` and `README.md` have drifted from the implementation before.

## 1. Baseline facts (verify, don't trust blindly)

**Purpose** — Local web app that indexes a document repository (usually a git
clone full of Excel/Office files, e.g. `DOC_ROOT_DIR` in `.env`), lets the user
search/filter by name, folder, version and tag, bookmark files into groups,
preview them in the browser, and open them in a desktop app (LibreOffice /
Excel / OS default) or reveal them in the file manager. "Sync" runs `git pull`
on the repo then rescans.

**Stack** — Node.js 22, Express 4, `better-sqlite3` (file `data/doc-reader.db`),
`exceljs` for XLSX preview, `pino-http` logging. Frontend is one file
`public/index.html` (Alpine.js + Tailwind, both from CDN, no build step).
Tests: Vitest (unit, integration via Supertest), Playwright scripts.

**Entry points**
- `src/server.js` → `src/app.js` (mounts every router under `/api`, serves `public/`)
- `src/config/env.js` (`DOC_ROOT_DIR`, `PORT`, `PLATFORM_MODE`)
- `src/config/openers.js` + `config/openers.json` (per-platform opener commands)
- `src/db/index.js` (opens DB, runs every `src/db/migrations/*.sql` on each start)

**Modules (`src/modules/`)**
| Module | Role | Main API |
|---|---|---|
| `scanner` | Recursive walk, extension whitelist, upsert into `documents`, recompute `is_latest` | `POST /api/scan`, `GET /api/scan/:id/status`, `/stream` (SSE) |
| `parser` | Filename → `version_num`, `version_date`, `base_name` from `_V<n>_<yyyymmdd>` | used by scanner |
| `search` | Filtered/sorted/paginated listing, modules, versions of one doc | `GET /api/documents`, `/api/modules`, `/api/documents/:id/versions` |
| `bookmarks` | Groups + items, outdated detection, "update to latest" | `/api/bookmark-groups*`, `/api/bookmark-items*` |
| `tags` | Tag CRUD + document↔tag links | `/api/tags*`, `/api/documents/:id/tags*` |
| `preview` | JSON preview (xlsx/csv/text) or raw stream (pdf/images) | `/api/documents/:id/preview`, `/raw` |
| `opener` | Spawn desktop app / reveal in folder; WSL path conversion | `/api/documents/:id/open`, `/reveal`, `/api/openers` |
| `gitsync` | `git pull` in `DOC_ROOT_DIR`, then rescan | `POST /api/sync` |

`src/routes/*.js` are thin re-exports or small routers; `src/modules/bookmark/`
and `src/modules/opener/opener.js` are legacy aliases.

**Data model** — `documents` (unique `file_path`, version fields, `module_path`
= parent folder, `base_name`, `is_latest`), `bookmark_groups`, `bookmark_items`,
`tags`, `document_tags`, `scan_logs`. `is_latest` = top row per
(`module_path`, `base_name`) ordered by `version_num`, then `version_date`.

## 2. Verify before summarizing

Keep reads small (see `docs/optimize.md`):
1. `git log --oneline -10` and `git status` — recent work and uncommitted state.
2. `ls src/modules` and `grep -n "router\.\(get\|post\|put\|patch\|delete\)" -r src` — module and route list still match the table.
3. `ls src/db/migrations` — schema changes since this skill was written.
4. `cat package.json` — scripts and dependencies (README lists scripts that may not exist).
5. `docs/PROJECT_STATE.md` — claimed phase/next steps; flag anything the code contradicts.

Update section 1 of this file if you find the baseline is out of date.

## 3. Output format

Unless the user asks for another shape, answer with:

1. **One-paragraph overview** — what it is and who uses it.
2. **Architecture** — stack + the module table (trimmed to what matters for the question).
3. **Main flows** — scan → index → search → preview/open; bookmark/tag; git sync.
4. **Current state** — last commits, test status (say if you did not run tests), uncommitted changes.
5. **Risks / known issues** — the top items only, each with a `file:line` reference.

Keep it under ~60 lines. Link files as `path:line`. Do not paste source code.
