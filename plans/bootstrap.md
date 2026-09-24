# Phase 0 – Bootstrap Plan

**Goal**: Establish a functional Node.js/Express server with SQLite, health endpoint, and migration script.

### Inputs / Outputs
- Input: No external input.
- Output: `npm start` runs server on `${PORT}`; `GET /health` returns `{status: "ok"}`; `npm run migrate` creates DB tables.

### Files to Create / Modify
- `package.json`
- `.gitignore` (already created)
- `.env.example` (environment template)
- `src/config/env.js`
- `src/db/index.js`
- `src/db/migrations/001-init.sql`
- `scripts/migrate.js`
- `src/app.js`
- `src/server.js`
- `src/middleware/request-logger.js`
- `src/middleware/error-handler.js`
- `tests/unit/env.test.js`
- `tests/integration/health.test.js`

### Edge Cases / Risks
- Missing required env vars → `env.test.js` will catch.
- `data/` directory missing → `src/db/index.js` creates it.
- `better-sqlite3` native build issues → ensure Node 22 LTS compatibility.

### Test Strategy
- Unit test validates that missing `DOC_ROOT_DIR` or `PORT` throws.
- Integration test uses Supertest to confirm `/health` returns 200 with JSON `{status:"ok"}`.

### Checklist before proceeding
- [ ] All directories exist.
- [ ] `.env.example` created.
- [ ] Migration script ready.
- [ ] Basic server code in place.
- [ ] Tests written.

### Next Steps
1. Implement files.
2. Run `npm install`.
3. Execute `npm run migrate`.
4. Run `npm test`.
5. Verify all passes before moving to Phase 1.
