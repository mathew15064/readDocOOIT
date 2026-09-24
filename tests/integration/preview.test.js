// tests/integration/preview.test.js
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
process.env.DOC_ROOT_DIR = process.env.DOC_ROOT_DIR || process.cwd();
process.env.PORT = process.env.PORT || '3081';

const app = require('../../src/app.js');
const db = require('../../src/db/index.js');

describe('Preview API Integration Tests', () => {
  let docId;
  const testDir = path.join(process.cwd(), 'tests', 'fixtures', 'preview_test');

  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true });
    const txtPath = path.join(testDir, 'integration_sample.txt');
    fs.writeFileSync(txtPath, 'Integration preview text content');

    db.prepare(`
      INSERT OR REPLACE INTO documents 
      (id, file_path, file_name, file_ext, file_size, mtime, version_num, version_date, module_path, doc_type, base_name, is_latest, indexed_at)
      VALUES 
      (9201, '${txtPath}', 'integration_sample.txt', 'txt', 32, datetime('now'), 1, '20260901', '/test', 'txt', 'int_sample', 1, datetime('now'))
    `).run();

    docId = 9201;
  });

  it('GET /api/documents/:id/raw streams raw bytes with headers', async () => {
    const res = await request(app).get(`/api/documents/${docId}/raw`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.headers['content-disposition']).toContain('inline');
    expect(res.text).toBe('Integration preview text content');
  });

  it('GET /api/documents/:id/preview returns structured json', async () => {
    const res = await request(app).get(`/api/documents/${docId}/preview`);
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('text');
    expect(res.body.content).toBe('Integration preview text content');
  });

  it('returns 404 for unknown document id', async () => {
    const res = await request(app).get('/api/documents/999999/preview');
    expect(res.status).toBe(404);
  });
});
