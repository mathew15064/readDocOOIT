// tests/unit/preview.test.mjs
import { describe, test, expect, beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
process.env.DOC_ROOT_DIR = process.env.DOC_ROOT_DIR || process.cwd();
process.env.PORT = process.env.PORT || '3081';

const db = require('../../src/db/index.js');
const previewService = require('../../src/modules/preview/preview.service.js');

describe('preview.service unit tests', () => {
  let txtDocId, csvDocId, xlsxDocId, largeDocId, outsideDocId;
  const testDir = path.join(process.cwd(), 'tests', 'fixtures', 'preview_test');

  beforeAll(async () => {
    fs.mkdirSync(testDir, { recursive: true });

    // 1. Text file
    const txtPath = path.join(testDir, 'sample.txt');
    fs.writeFileSync(txtPath, 'Hello Preview World\nLine 2 text');

    // 2. CSV file
    const csvPath = path.join(testDir, 'sample.csv');
    fs.writeFileSync(csvPath, 'Name,Age,Role\nAlice,30,Engineer\nBob,25,Designer\n"Charlie, Jr.",22,Intern');

    // 3. XLSX file
    const xlsxPath = path.join(testDir, 'sample.xlsx');
    const workbook = new ExcelJS.Workbook();
    const sheet1 = workbook.addWorksheet('Summary');
    sheet1.addRow(['ID', 'Item', 'Price']);
    sheet1.addRow([1, 'Widget A', 100]);
    sheet1.addRow([2, 'Widget B', 200]);
    const sheet2 = workbook.addWorksheet('Details');
    sheet2.addRow(['Detail 1', 'Detail 2']);
    await workbook.xlsx.writeFile(xlsxPath);

    // 4. Large text file (>500KB)
    const largePath = path.join(testDir, 'large.txt');
    const largeBuf = Buffer.alloc(600 * 1024, 'a');
    fs.writeFileSync(largePath, largeBuf);

    // Insert records in documents table
    db.prepare(`
      INSERT OR REPLACE INTO documents 
      (id, file_path, file_name, file_ext, file_size, mtime, version_num, version_date, module_path, doc_type, base_name, is_latest, indexed_at)
      VALUES 
      (9101, '${txtPath}', 'sample.txt', 'txt', 25, datetime('now'), 1, '20260901', '/test', 'txt', 'sample', 1, datetime('now')),
      (9102, '${csvPath}', 'sample.csv', 'csv', 50, datetime('now'), 1, '20260901', '/test', 'csv', 'sample', 1, datetime('now')),
      (9103, '${xlsxPath}', 'sample.xlsx', 'xlsx', 500, datetime('now'), 1, '20260901', '/test', 'xlsx', 'sample', 1, datetime('now')),
      (9104, '${largePath}', 'large.txt', 'txt', 614400, datetime('now'), 1, '20260901', '/test', 'txt', 'large', 1, datetime('now')),
      (9105, '/outside/root/doc.txt', 'doc.txt', 'txt', 10, datetime('now'), 1, '20260901', '/outside', 'txt', 'doc', 1, datetime('now'))
    `).run();

    txtDocId = 9101;
    csvDocId = 9102;
    xlsxDocId = 9103;
    largeDocId = 9104;
    outsideDocId = 9105;
  });

  test('previews text file properly', async () => {
    const preview = await previewService.getFilePreview(txtDocId, process.env);
    expect(preview.type).toBe('text');
    expect(preview.content).toContain('Hello Preview World');
  });

  test('previews csv file properly with headers and rows', async () => {
    const preview = await previewService.getFilePreview(csvDocId, process.env);
    expect(preview.type).toBe('csv');
    expect(preview.headers).toEqual(['Name', 'Age', 'Role']);
    expect(preview.rows.length).toBe(3);
    expect(preview.rows[0]).toEqual(['Alice', '30', 'Engineer']);
    expect(preview.rows[2][0]).toBe('Charlie, Jr.');
  });

  test('previews xlsx file with multiple sheets and rows', async () => {
    const preview = await previewService.getFilePreview(xlsxDocId, process.env);
    expect(preview.type).toBe('xlsx');
    expect(preview.sheets.length).toBe(2);
    expect(preview.sheets[0].name).toBe('Summary');
    expect(preview.sheets[0].headers).toEqual(['ID', 'Item', 'Price']);
    expect(preview.sheets[0].rows.length).toBe(2);
    expect(preview.sheets[1].name).toBe('Details');
  });

  test('rejects file exceeding size limit with 413', async () => {
    await expect(previewService.getFilePreview(largeDocId, process.env)).rejects.toThrow('PAYLOAD_TOO_LARGE');
  });

  test('rejects path outside root with 403', async () => {
    await expect(previewService.getFilePreview(outsideDocId, process.env)).rejects.toThrow('PATH_OUTSIDE_ROOT');
  });

  test('rejects unknown document id with 404', async () => {
    await expect(previewService.getFilePreview(999999, process.env)).rejects.toThrow('DOC_NOT_FOUND');
  });

  test('getFileRaw returns stream and mimeType', async () => {
    const raw = await previewService.getFileRaw(txtDocId, process.env);
    expect(raw.mimeType).toBe('text/plain; charset=utf-8');
    expect(raw.fileName).toBe('sample.txt');
    expect(raw.stream).toBeDefined();
  });
});
