// tests/unit/parser.test.mjs
import { describe, test, expect } from 'vitest';
import parser from '../../src/modules/parser/index.js';
const { parseFilename } = parser;


describe('parseFilename', () => {
  test('extracts version and date correctly', () => {
    const result = parseFilename('Design_V12_20230101.pdf');
    expect(result.version_num).toBe(12);
    expect(result.version_date).toBe('20230101');
    expect(result.base_name).toBe('Design');
    expect(result.file_ext).toBe('pdf');
  });

  test('handles missing date', () => {
    const result = parseFilename('Report_V3.docx');
    expect(result.version_num).toBe(3);
    expect(result.version_date).toBeNull();
    expect(result.base_name).toBe('Report');
    expect(result.file_ext).toBe('docx');
  });

  test('handles filenames without version', () => {
    const result = parseFilename('Readme.md');
    expect(result.version_num).toBeNull();
    expect(result.version_date).toBeNull();
    expect(result.base_name).toBe('Readme');
    expect(result.file_ext).toBe('md');
  });
});
