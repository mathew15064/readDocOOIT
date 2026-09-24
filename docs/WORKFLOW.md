# 🔁 Mandatory Workflow for Every Task

For EVERY task, you MUST follow this loop:

1. READ DOC
   └─> docs/README.md → docs/PROJECT_STATE.md → docs/modules/<module>.md
       If a file doesn't exist yet → create it BEFORE coding.
2. PLAN
   └─> Write a short plan to plans/<task-id>.md: Input/Output, Edge cases, Test cases, Files to create/modify, Risks.
3. DO TASK
   └─> Code per plan. Small commits, one idea per commit. DO NOT touch files outside task scope.
4. TEST & FIX BUG
   └─> Run `npm test` (unit + integration). Run `npm run test:e2e` if UI involved. Fix until 100% green.
5. CODE REVIEW (self-review checklist)
   - [ ] No hard-coded secrets
   - [ ] Full error handling
   - [ ] No event-loop blocking
   - [ ] Adequate debug logs
   - [ ] Module boundary respected
   - [ ] Covered by tests
6. IF ISSUES → go back to step 2 (NEVER patch blindly)
7. UPDATE DOC & STATE
   - [ ] Update docs/PROJECT_STATE.md
   - [ ] Update docs/modules/<module>.md
   - [ ] Add ADR to docs/ARCHITECTURE.md if architecture decision was made

## Anti-patterns (FORBIDDEN)
- Skipping tests
- Editing files outside scope
- Code first, doc later
- Merging while tests are red
- Hard-coding secrets/tokens/paths
- Using `fs.readdirSync` / `fs.statSync` inside request handlers
- Using `child_process.exec` / `execSync`
