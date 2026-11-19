import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { resolveWithinRoot } = require('../../src/utils/path-guard.js');

describe('document root boundary', () => {
  let base;
  let root;
  let insideFile;
  let siblingFile;

  beforeAll(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-root-test-'));
    root = path.join(base, 'docs');
    const sibling = path.join(base, 'docs-other');
    fs.mkdirSync(root);
    fs.mkdirSync(sibling);
    insideFile = path.join(root, 'file.txt');
    siblingFile = path.join(sibling, 'file.txt');
    fs.writeFileSync(insideFile, 'inside');
    fs.writeFileSync(siblingFile, 'outside');
    fs.symlinkSync(siblingFile, path.join(root, 'linked-outside.txt'));
  });

  afterAll(() => fs.rmSync(base, { recursive: true, force: true }));

  test('allows existing files in root', async () => {
    await expect(resolveWithinRoot(insideFile, root)).resolves.toBe(insideFile);
  });

  test('rejects sibling directories with similar prefixes', async () => {
    await expect(resolveWithinRoot(siblingFile, root)).rejects.toThrow('PATH_OUTSIDE_ROOT');
  });

  test('rejects symlinks pointing outside root', async () => {
    await expect(resolveWithinRoot(path.join(root, 'linked-outside.txt'), root))
      .rejects.toThrow('PATH_OUTSIDE_ROOT');
  });

  test('rejects traversal and permits nested folders', async () => {
    await expect(resolveWithinRoot(path.join(root, '..', 'docs-other', 'file.txt'), root))
      .rejects.toThrow('PATH_OUTSIDE_ROOT');
    const nested = path.join(root, 'nested');
    fs.mkdirSync(nested);
    await expect(resolveWithinRoot(nested, root)).resolves.toBe(nested);
  });
});
