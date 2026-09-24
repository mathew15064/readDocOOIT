import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
process.env.DOC_ROOT_DIR = process.env.DOC_ROOT_DIR || process.cwd();
process.env.PORT = process.env.PORT || '3081';

const app = require('../../src/app.js');
const db = require('../../src/db/index.js');

describe('GET /api/documents & /api/modules', () => {
  beforeAll(() => {
    db.exec(`
      INSERT OR REPLACE INTO documents 
      (file_path, file_name, file_ext, file_size, mtime, version_num, version_date, module_path, doc_type, base_name, is_latest, indexed_at) 
      VALUES 
      ('/tmp/mod1/Doc_V1_20230101.pdf', 'Doc_V1_20230101.pdf', 'pdf', 100, datetime('now'), 1, '20230101', '/tmp/mod1', 'pdf', 'Doc', 0, datetime('now')),
      ('/tmp/mod1/Doc_V2_20230201.pdf', 'Doc_V2_20230201.pdf', 'pdf', 120, datetime('now'), 2, '20230201', '/tmp/mod1', 'pdf', 'Doc', 1, datetime('now')),
      ('/tmp/mod2/Report_V1_20230101.docx', 'Report_V1_20230101.docx', 'docx', 200, datetime('now'), 1, '20230101', '/tmp/mod2', 'docx', 'Report', 1, datetime('now'))
    `);
  });

  it('fetches all documents', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(200);
    expect(res.body.documents.length).toBeGreaterThanOrEqual(3);
  });

  it('filters by module_path', async () => {
    const res = await request(app).get('/api/documents?module=/tmp/mod1');
    expect(res.status).toBe(200);
    expect(res.body.documents.length).toBe(2);
  });

  it('filters by only_latest=true', async () => {
    const res = await request(app).get('/api/documents?module=/tmp/mod1&only_latest=true');
    expect(res.status).toBe(200);
    expect(res.body.documents.length).toBe(1);
    expect(res.body.documents[0].version_num).toBe(2);
  });

  it('fetches unique modules list', async () => {
    const res = await request(app).get('/api/modules');
    expect(res.status).toBe(200);
    expect(res.body.modules).toContain('/tmp/mod1');
    expect(res.body.modules).toContain('/tmp/mod2');
  });

  it('fetches all versions of a document with current and latest/oldest flags', async () => {
    const doc1 = db.prepare("SELECT id FROM documents WHERE file_name = 'Doc_V1_20230101.pdf'").get();
    const doc2 = db.prepare("SELECT id FROM documents WHERE file_name = 'Doc_V2_20230201.pdf'").get();

    const res = await request(app).get(`/api/documents/${doc1.id}/versions?currentId=${doc1.id}`);
    expect(res.status).toBe(200);
    expect(res.body.base_name).toBe('Doc');
    expect(res.body.module_path).toBe('/tmp/mod1');
    expect(res.body.total).toBe(2);

    const v1 = res.body.versions.find((v) => v.id === doc1.id);
    const v2 = res.body.versions.find((v) => v.id === doc2.id);

    expect(v1.is_current).toBe(1);
    expect(v1.is_oldest).toBe(1);
    expect(v1.is_latest).toBe(0);

    expect(v2.is_current).toBe(0);
    expect(v2.is_latest).toBe(1);
    expect(v2.is_oldest).toBe(0);
  });

  it('returns 404 for versions of unknown document id', async () => {
    const res = await request(app).get('/api/documents/999999/versions');
    expect(res.status).toBe(404);
  });
});
