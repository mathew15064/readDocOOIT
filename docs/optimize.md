# AI Agent Cache & Token Optimization Rules — Doc Reader

## Primary Objective
Optimize every interaction with any LLM/AI agent for:
1. Maximum prompt cache reuse.
2. Minimum input token consumption.
3. Minimum repeated context.
4. Minimum unnecessary file reads.
5. Maximum preservation of a stable prompt prefix.
6. No loss of implementation correctness.

## 0. Loading Policy
### Always load (stable prompt prefix — every session, in order)
- `docs/README.md` → bootloader / router / entry point
- `docs/ARCHITECTURE.md` → global stable context (stack, ADRs, module boundaries)
- `docs/PROJECT_STATE.md` → current state (phase, implemented/partial, bugs, next steps)
- `docs/optimize.md` → this file (rules + loading policy)
These four files are the **only** context a fresh session needs to orient itself.

### Conditional load (task-routed — read ONLY the relevant document)
- Architecture decisions: `docs/ARCHITECTURE.md`
- Workflow: `docs/WORKFLOW.md`
- Test strategy: `docs/TESTING.md`
- Scanner: `docs/modules/01-scanner.md`
- Parser: `docs/modules/02-parser.md`
- Opener: `docs/modules/03-opener.md`
- Search UI: `docs/modules/04-search-ui.md`
- Bookmark: `docs/modules/05-bookmark.md`
- Git sync: `docs/modules/06-git-sync.md`
Do **not** load all of these for every task.

### Lessons (on demand only)
- `docs/LESSONS.md` — read only when the task involves a past bug/pattern.

### Stability rule
The four always-loaded files are the prompt-cache prefix. Keep them byte-stable across sessions: Do not rewrite wording, do not reorder sections, do not insert transient task information. All changing information goes into `docs/PROJECT_STATE.md` or `docs/LESSONS.md`.

## 1. Stable Context Must Stay Stable
Treat these as stable context for doc-reader:
- Stack: Node.js 22 + Express + `better-sqlite3`.
- Frontend: HTML + TailwindCSS (CDN) + Alpine.js (no build step).
- File opener: `child_process.spawn` only — **never** `exec`.
- Credentials: none (local only, no auth).
- DB: SQLite at `./data/doc-reader.db`.
- Tests: Vitest (unit) + Supertest (integration) + Playwright (E2E).
- Module boundaries: each module in `src/modules/<name>/` with `index.js` as public API.
- Workflow (mandatory): read doc → plan → do → test → review → update state.

## 2. Never Reload the Entire Project Unnecessarily
Prefer: `search → identify relevant file in src/modules/<x>/ → read relevant section → modify` instead of `read entire repository → understand everything → modify`.

## 3. Avoid Re-reading Unchanged Files
If a file has already been inspected and nothing indicates it changed, do not read it again.

## 4. Minimize Tool Output
Prefer `grep -n`, `sed -n`, or `rg` over `cat <large file>`. Do not request `node_modules/`, `.git/`, `coverage/`, `data/`, `.env`, `test-results/` unless explicitly required.

## 5. Do Not Repeat File Contents
When explaining or reasoning about a modification, do NOT reproduce an entire unchanged file. Instead describe the change (e.g., "Modified: src/modules/opener/opener.service.js - added path traversal guard").

## 6. Keep Dynamic Information at the End
Current task information is dynamic. Keep it after stable project context. Do not inject dynamic information into stable rules.

## 7. Do Not Repeat the User's Request
Convert the request directly into an implementation plan. Bad: "The user wants us to modify...". Better: "Inspect src/modules/opener/opener.service.js. Change: add path.resolve guard."

## 8. Do Not Repeat Previous Decisions
If a design decision has already been established (recorded in `docs/ARCHITECTURE.md` ADRs), do not reconsider it unnecessarily. Continue from the existing decision.

## 9. Incremental Context Only
When new information becomes available, add only the new information. Do not rebuild the entire context.

## 10. Search Before Reading
For unfamiliar code: 1. Search for the relevant class/function. 2. Identify its file. 3. Inspect only the relevant code.

## 11. Read Large Files Selectively
Find the relevant method first (`grep -n`), read a limited surrounding region, expand only when required.

## 12. Context Compression
When context becomes large, compress old information into a short structured summary (Stack, Modules, DB, Current feature, Files modified, Remaining).

## 13. Preserve Important Context
Never compress away information required for correctness: User requirements, constraints, ADRs, DB schema, API contracts, bugs, current state.

## 14. Avoid Unnecessary Planning
For small tasks, do not generate a large implementation plan. Use the smallest plan that is sufficient.

## 15. Minimize Verification Context
When verifying changes, prefer targeted checks (`npx vitest run src/modules/opener/`, `curl http://localhost:3081/health`). Only expand verification when the targeted check fails.

## 16. Do Not Generate Unnecessary Documentation
Do not create documentation unless explicitly asked or required by the workflow (`PROJECT_STATE.md` update, ADRs).
