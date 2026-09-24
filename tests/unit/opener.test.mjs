// tests/unit/opener.test.mjs
import { describe, test, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

process.env.DOC_ROOT_DIR = process.env.DOC_ROOT_DIR || process.cwd();
process.env.PORT = process.env.PORT || '3081';

const cp = require('child_process');
const mockSpawn = vi.fn(() => ({
  on: vi.fn((event, cb) => {
    if (event === 'spawn') setTimeout(cb, 0);
  }),
  unref: vi.fn()
}));
cp.spawn = mockSpawn;

const { openFile, revealInFolder } = require('../../src/modules/opener/opener.service.js');
const app = require('../../src/app.js');
const db = require('../../src/db/index.js');
const env = require('../../src/config/env.js');

describe('openFile unit tests', () => {
  const dummyFile = path.resolve(process.cwd(), 'data', 'unit-dummy.txt');
  const dummyFolder = path.resolve(process.cwd(), 'data');

  beforeAll(() => {
    if (!fs.existsSync(dummyFolder)) {
      fs.mkdirSync(dummyFolder, { recursive: true });
    }
    fs.writeFileSync(dummyFile, 'hello');
  });

  beforeEach(() => {
    mockSpawn.mockClear();
  });

  test('file outside DOC_ROOT_DIR throws PATH_OUTSIDE_ROOT', async () => {
    await expect(openFile('/outside/root/file.txt', env)).rejects.toThrow('PATH_OUTSIDE_ROOT');
  });

  test('file does not exist throws ENOENT', async () => {
    const nonexistent = path.resolve(env.DOC_ROOT_DIR, 'nonexistent-doc.txt');
    await expect(openFile(nonexistent, env)).rejects.toThrow(/ENOENT/);
  });

  test('folder passed in throws NOT_A_FILE', async () => {
    await expect(openFile(dummyFolder, env)).rejects.toThrow('NOT_A_FILE');
  });

  test('spawns OS command correctly on happy path', async () => {
    const result = await openFile(dummyFile, env);
    expect(result).toEqual({ opened: true, filePath: dummyFile });
    expect(mockSpawn).toHaveBeenCalledTimes(1);

    const [calledCmd, calledArgs] = mockSpawn.mock.calls[0];
    if (process.platform === 'win32') {
      expect(calledCmd).toBe('cmd');
      expect(calledArgs).toEqual(['/c', 'start', '', dummyFile]);
    } else if (process.platform === 'darwin') {
      expect(calledCmd).toBe('open');
      expect(calledArgs).toEqual([dummyFile]);
    } else {
      expect(calledCmd).toBe('xdg-open');
      expect(calledArgs).toEqual([dummyFile]);
    }
  });

  test('revealInFolder spawns OS file manager correctly', async () => {
    const result = await revealInFolder(dummyFile, env);
    expect(result.revealed).toBe(true);
    expect(result.folder).toBe(path.dirname(dummyFile));
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/open-file integration tests', () => {
  const dummyFilePath = path.resolve(process.cwd(), 'data', 'dummy.txt');
  let insertedDocId;

  beforeAll(() => {
    const dataDir = path.dirname(dummyFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(dummyFilePath, 'dummy content');

    db.exec(
      `INSERT OR REPLACE INTO documents 
      (file_path, file_name, file_ext, file_size, mtime, version_num, version_date, module_path, doc_type, base_name, is_latest, indexed_at) 
      VALUES (?, ?, ?, 0, datetime('now'), NULL, NULL, ?, '', 'dummy', 1, datetime('now'))`,
      [dummyFilePath, 'dummy.txt', 'txt', dataDir]
    );
    const row = db.prepare('SELECT id FROM documents WHERE file_path = ?').get(dummyFilePath);
    insertedDocId = row.id;
  });

  beforeEach(() => {
    mockSpawn.mockClear();
  });

  test('missing filePath returns 400', async () => {
    const res = await request(app).post('/api/open-file').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/filePath is required/);
  });

  test('path outside root returns 403', async () => {
    const res = await request(app).post('/api/open-file').send({ filePath: '/outside/path.txt' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PATH_OUTSIDE_ROOT');
  });

  test('happy path opens existing file successfully', async () => {
    const res = await request(app)
      .post('/api/open-file')
      .send({ filePath: dummyFilePath });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ opened: true, filePath: dummyFilePath });
  });

  test('POST /api/documents/:id/open opens by document id', async () => {
    const res = await request(app).post(`/api/documents/${insertedDocId}/open`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ opened: true, filePath: dummyFilePath });
  });

  test('POST /api/documents/:id/open returns 404 for unknown doc id', async () => {
    const res = await request(app).post('/api/documents/999999/open');
    expect(res.status).toBe(404);
  });

  test('POST /api/documents/:id/reveal reveals existing file in folder', async () => {
    const res = await request(app).post(`/api/documents/${insertedDocId}/reveal`);
    expect(res.status).toBe(200);
    expect(res.body.revealed).toBe(true);
    expect(mockSpawn).toHaveBeenCalled();
  });

  test('POST /api/documents/:id/reveal returns 404 for unknown doc id', async () => {
    const res = await request(app).post('/api/documents/999999/reveal');
    expect(res.status).toBe(404);
  });
});
