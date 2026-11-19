import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-gitsync-test-'));
const remote = path.join(base, 'remote.git');
const repo = path.join(base, 'documents');
const author = path.join(base, 'author');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }).trim();
}

process.env.DOC_ROOT_DIR = repo;
process.env.PORT = '3081';

const { gitPull } = require('../../src/modules/gitsync');
const db = require('../../src/db');

describe('git sync reliability', () => {
  beforeAll(() => {
    fs.mkdirSync(repo, { recursive: true });
    fs.mkdirSync(author);
    git(base, 'init', '--bare', remote);
    git(author, 'init');
    git(author, 'config', 'user.email', 'tests@example.invalid');
    git(author, 'config', 'user.name', 'Git Sync Test');
    fs.writeFileSync(path.join(author, 'document.txt'), 'first');
    git(author, 'add', '.');
    git(author, 'commit', '-m', 'initial');
    git(author, 'branch', '-M', 'main');
    git(author, 'remote', 'add', 'origin', remote);
    git(author, 'push', '-u', 'origin', 'main');
    git(base, '--git-dir', remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
    fs.rmdirSync(repo);
    git(base, 'clone', remote, repo);
  });

  afterAll(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  it('skips unnecessary rescan when repository is already current', async () => {
    const first = await gitPull();
    expect(first.status).toBe('ok');
    expect(first.changed).toBe(false);
    expect(first.scanStatus).toBe('skipped');
    expect(db.prepare('SELECT COUNT(*) AS n FROM scan_logs').get().n).toBe(0);
  });

  it('pulls new commits and indexes updated documents', async () => {
    fs.writeFileSync(path.join(author, 'new-file.txt'), 'second');
    git(author, 'add', '.');
    git(author, 'commit', '-m', 'add doc');
    git(author, 'push', 'origin', 'main');
    const result = await gitPull();
    expect(result.status).toBe('ok');
    expect(result.changed).toBe(true);
    expect(result.scanStatus).toBe('completed');
    expect(db.prepare('SELECT COUNT(*) AS n FROM documents WHERE file_name = ?').get('new-file.txt').n).toBe(1);
    const next = await gitPull();
    expect(next.changed).toBe(false);
  });
});
