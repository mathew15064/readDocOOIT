# 📂 Local Document Reader & Bookmark Manager

A local web app for indexing, searching, bookmarking, and quickly opening project documents that live in deeply nested Git repository folder structures.

## 🌟 Highlights
- **Auto Scanner**: Recursively indexes the document repo.
- **Version Parser**: Extracts `V<n>_<yyyymmdd>` from filenames.
- **Multi-App Opener**: Opens files with Excel, LibreOffice, or OS default.
- **Fast Search & Bookmark**: Full-text search, filter by module/version/tag.
- **Zero-Build Frontend**: HTML + TailwindCSS (CDN) + Alpine.js.

## 📚 Documentation Reading Order

### Always load (every session, in order)
1. `docs/README.md` — this file (router)
2. `docs/ARCHITECTURE.md` — stack, module boundaries, ADRs
3. `docs/PROJECT_STATE.md` — current phase, completed work, blockers
4. `docs/optimize.md` — cache/token rules

### Load on demand (task-routed)
5. `docs/WORKFLOW.md` — strict task lifecycle
6. `docs/TESTING.md` — test strategy
7. Module specs under `docs/modules/` (01-scanner.md to 06-git-sync.md)
8. `docs/LESSONS.md` (read only when debugging)

## 🤖 For AI Agents
Before starting any task, read in order: README.md, ARCHITECTURE.md, PROJECT_STATE.md, optimize.md.
Then route by task domain. Keep the stable prefix byte-stable. Put dynamic content at the end. Search before reading. Never fake memory. Priority: correctness > user requirements > project rules > cache optimization > token minimization.
