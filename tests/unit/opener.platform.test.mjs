// tests/unit/opener.platform.test.mjs
import { describe, test, expect, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function loadFreshConfig() {
  delete require.cache[require.resolve('../../src/config/openers')];
  return require('../../src/config/openers');
}

describe('loadOpeners platform handling', () => {
  const originalEnv = { ...process.env };

  afterAll(() => {
    process.env = originalEnv;
    delete require.cache[require.resolve('../../src/config/openers')];
  });

  test('WINDOWS mode selects win32 entry', () => {
    process.env.PLATFORM_MODE = 'windows';
    const { loadOpeners } = loadFreshConfig();
    const openers = loadOpeners();
    const libre = openers.find(o => o.id === 'libre');
    expect(libre).toBeDefined();
    expect(libre.command.startsWith('C:\\')).toBe(true);
    expect(libre.pathStrategy).toBe('native');
  });

  test('WSL mode selects wsl entry', () => {
    process.env.PLATFORM_MODE = 'wsl';
    const { loadOpeners } = loadFreshConfig();
    const openers = loadOpeners();
    const libre = openers.find(o => o.id === 'libre');
    expect(libre).toBeDefined();
    expect(libre.command.startsWith('/mnt/c/')).toBe(true);
    expect(libre.pathStrategy).toBe('windows');
  });

  test('non‑WSL Linux filters out missing platform entries', () => {
    process.env.PLATFORM_MODE = 'auto';
    // Mock process.platform to linux and simulate not WSL
    const origPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const existsSyncOrig = fs.existsSync;
    const readFileSyncOrig = fs.readFileSync;
    fs.existsSync = () => false; // not WSL
    const { loadOpeners } = loadFreshConfig();
    const openers = loadOpeners();
    const excel = openers.find(o => o.id === 'excel');
    expect(excel).toBeUndefined();
    // restore mocks
    fs.existsSync = existsSyncOrig;
    fs.readFileSync = readFileSyncOrig;
    if (origPlatform) Object.defineProperty(process, 'platform', origPlatform);
  });
});
