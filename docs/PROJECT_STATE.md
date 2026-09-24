# Current Phase: Phase 9 — Tooling, Docs & Final Polish (Completed)

### Phase Execution Progress
- [x] **Phase 0 – Bootstrap**: Node + Express + SQLite + migrations.
- [x] **Phase 1 – Scanner & Parser**: Recursive scan, version regex, `is_latest`.
- [x] **Phase 2 – Opener API**: OS default opener, reveal in folder.
- [x] **Phase 3 – UI Search & Bookmark**: Alpine + Tailwind, search, bookmark.
- [x] **Phase 4 – Git Sync & Auto-Update**.
- [x] **Phase 5 – UI/UX Polish & Claude Design System**:
  - [x] Claude warm editorial theme (cream + coral + navy).
  - [x] Flex layout with single scroll area per pane.
  - [x] Drag & drop tags onto document rows.
  - [x] Right-click context menus (doc / bookmark / tag).
  - [x] Bookmark Group detail modal with search + bulk actions.
  - [x] Inline web preview (XLSX / CSV / PDF / image / text).
  - [x] Scanner extension whitelist (removed .git + tool noise).
  - [x] Alpine null-safety fix (`x-if` + optional chaining).
- [x] **Phase 8 – Multi-Option Opener + WSL-aware reveal + Modal UX**: Split-button opener (LibreOffice/Excel/OS default), per-platform `config/openers.json`, `PLATFORM_MODE` env override, WSL path handling (wslpath for /mnt, UNC / temp-copy for /home), Group Picker modal with search, Add Bookmark modal shows existing bookmarks as a table, z-index tier stack for nested modals, actions column responsive with labels hidden below xl.
- [x] **Phase 9 – Tooling + Docs + Makefile**: `npm run shots` (20 Playwright screenshots), `scripts/verify-responsive.mjs` (7 viewports), Makefile with first-time setup + common tasks, README rewrite with install guide, screenshot workflow rule in WORKFLOW.md.

### Test Status
- Unit: 51/51 pass
- Integration: 20/20 pass
- E2E (Playwright verify-task5 & verify-responsive): 7/7 viewports pass

### Active Blockers
None.

### Next Steps (future work)
- Outdated bookmark detection (already partially implemented — verify in prod).
- Auto-sync via cron.
- Export bookmarks to JSON.
- Multi-user support (out of scope for local-only tool).
