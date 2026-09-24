# 🧪 Testing Strategy & Guidelines

## Overview
Quality is guaranteed through a multi-tier test pyramid:
1. **White-Box Unit Tests** (`vitest`): parser regex, path validation, version comparison, spawn mocking.
2. **Black-Box Integration Tests** (`supertest` + `better-sqlite3` in-memory): Express routes, scan flow, open-file API.
3. **End-to-End (E2E) Tests** (`@playwright/test`): Search → filter → open → bookmark.

## Running Tests
- All unit + integration: `npm test`
- With coverage: `npm run test:coverage`
- E2E: `npm run test:e2e`

## Quality Benchmarks
- Unit test coverage target: ≥ 80%
- Integration test coverage target: ≥ 70%
- E2E test critical path coverage: 100%
