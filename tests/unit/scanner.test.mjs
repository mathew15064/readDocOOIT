// tests/unit/scanner.test.mjs
import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import scanner from '../../src/modules/scanner/index.js';
const { scanDirectory } = scanner;
const db = require('../../src/db/index.js');

// Run migrations once before all tests and clear tables before each test
beforeAll(() => {
  const migrationPath = path.resolve(__dirname, '../../src/db/migrations/001-init.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  db.exec(sql);
});

beforeEach(() => {
  // Ensure DB tables are empty
  db.exec('DELETE FROM documents; DELETE FROM scan_logs;');
});

describe('scanDirectory integration', () => {
  let tempDir;

  beforeEach(() => {
    // create temp directory and files for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-test-'));
    fs.writeFileSync(path.join(tempDir, 'Doc_V1_20220101.txt'), 'content1');
    fs.writeFileSync(path.join(tempDir, 'Doc_V2_20220201.txt'), 'content2');
    fs.writeFileSync(path.join(tempDir, 'Other.txt'), 'other');
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('processes files and computes is_latest', async () => {
    const result = await scanDirectory(tempDir, []);
    expect(result.filesFound).toBe(3);
    expect(result.filesIndexed).toBe(3);

    const rows = db.prepare('SELECT file_name, version_num, is_latest FROM documents WHERE base_name = ?').all('Doc');
    expect(rows.length).toBe(2);
    const latest = rows.find(r => r.is_latest === 1);
    expect(latest.version_num).toBe(2);
    const older = rows.find(r => r.is_latest === 0);
    expect(older.version_num).toBe(1);
  });

  test('skips .git, node_modules, and non-whitelisted extensions like .json while indexing .pptx and .drawio', async () => {
    const gitDir = path.join(tempDir, '.git');
    fs.mkdirSync(gitDir, { recursive: true });
    fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main');
    fs.writeFileSync(path.join(gitDir, 'config'), '[core]');

    const nodeModulesDir = path.join(tempDir, 'node_modules', 'some-pkg');
    fs.mkdirSync(nodeModulesDir, { recursive: true });
    fs.writeFileSync(path.join(nodeModulesDir, 'index.txt'), 'pkg text');

    fs.writeFileSync(path.join(tempDir, 'metadata.json'), '{"key":"value"}');
    fs.writeFileSync(path.join(tempDir, 'ValidDoc_V1_20230101.pdf'), 'pdf content');
    fs.writeFileSync(path.join(tempDir, 'Presentation_V1_20230101.pptx'), 'pptx content');
    fs.writeFileSync(path.join(tempDir, 'Diagram.drawio'), 'drawio content');

    const result = await scanDirectory(tempDir, []);

    // ValidDoc_V1_20230101.pdf, Presentation_V1_20230101.pptx, Diagram.drawio, Doc_V1_20220101.txt, Doc_V2_20220201.txt, and Other.txt (6 files)
    expect(result.filesFound).toBe(6);
    expect(result.filesIndexed).toBe(6);

    const pptxRows = db.prepare("SELECT * FROM documents WHERE file_ext = 'pptx'").all();
    expect(pptxRows.length).toBe(1);

    const drawioRows = db.prepare("SELECT * FROM documents WHERE file_ext = 'drawio'").all();
    expect(drawioRows.length).toBe(1);

    const gitRows = db.prepare("SELECT * FROM documents WHERE file_path LIKE '%/.git/%'").all();
    expect(gitRows.length).toBe(0);

    const nodeModuleRows = db.prepare("SELECT * FROM documents WHERE file_path LIKE '%/node_modules/%'").all();
    expect(nodeModuleRows.length).toBe(0);

    const jsonRows = db.prepare("SELECT * FROM documents WHERE file_name = 'metadata.json'").all();
    expect(jsonRows.length).toBe(0);
  });
});
