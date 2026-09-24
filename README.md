# Doc Reader — Local Document Reader & Bookmark Manager

Local document reader, version search, and bookmark group manager with Anthropic/Claude design system.

## Quickstart

1. Install Node.js 22+.
2. `npm install`
3. Copy `.env.example` to `.env` and set `DOC_ROOT_DIR` to the absolute path of the document repo.
4. `npm run migrate`
5. `npm run start`
6. Open http://localhost:3081
7. Click **Rescan Repo** to index documents.

## Project Layout
- `src/modules/scanner/` — recursive file walker + DB upsert
- `src/modules/parser/` — filename → version/date/doc_type
- `src/modules/opener/` — OS default opener + reveal in folder
- `src/modules/documents/` — search, list, versions
- `src/modules/bookmarks/` — groups + items
- `src/modules/tags/` — tags + document_tags
- `public/` — Alpine.js + Tailwind UI
- `docs/` — architecture, ADRs, state, lessons

## Design System
See `docs/ARCHITECTURE.md` ADR "Claude Warm Editorial Design System".
Tokens live in the inline Tailwind config in `public/index.html`.
Custom utilities in `public/css/claude.css`.
