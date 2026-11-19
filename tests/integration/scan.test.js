import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
process.env.DOC_ROOT_DIR = process.env.DOC_ROOT_DIR || process.cwd();
process.env.PORT = process.env.PORT || '3081';
const app = require('../../src/app.js');
const db = require('../../src/db/index.js');

describe('POST /api/scan path restrictions', () => {
  const root = path.resolve(process.env.DOC_ROOT_DIR);
  const inside = path.join(root, 'scan-api-fixture');
  const outside = path.join(path.dirname(root), `${path.basename(root)}-outside-scan-fixture`);

  beforeAll(() => {
    fs.mkdirSync(inside, { recursive: true });
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(path.join(inside, 'scan-example.txt'), 'sample');
    fs.writeFileSync(path.join(outside, 'outside.txt'), 'not allowed');
    fs.symlinkSync(outside, path.join(inside, 'outside-link'));
  });

  afterAll(() => {
    fs.rmSync(inside, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });

  it('indexes an allowed subdirectory', async () => {
    const res = await request(app).post('/api/scan').send({ rootDir: inside });
    expect(res.status).toBe(200);
    expect(res.body.result.filesIndexed).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM documents WHERE file_path = ?')
      .get(path.join(inside, 'scan-example.txt')).n).toBe(1);
  });

  it('rejects a sibling directory even when its name starts similarly', async () => {
    const res = await request(app).post('/api/scan').send({ rootDir: outside });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PATH_OUTSIDE_ROOT');
  });

  it('rejects symlink escape and malformed ignore patterns', async () => {
    const linked = await request(app).post('/api/scan').send({ rootDir: path.join(inside, 'outside-link') });
    expect(linked.status).toBe(403);
    const malformed = await request(app).post('/api/scan').send({ rootDir: inside, ignorePatterns: 'not-an-array' });
    expect(malformed.status).toBe(400);
  });
});
