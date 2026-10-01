// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accessSync, statSync } from 'node:fs';
import { resolveGitExecutable } from '../lib/git-executable.mjs';

vi.mock('node:fs', () => ({ accessSync: vi.fn(), statSync: vi.fn(), constants: { X_OK: 1 } }));
afterEach(() => vi.resetAllMocks());

function installedAt(executable) {
  vi.mocked(statSync).mockImplementation((candidate) => {
    if (candidate !== executable) throw new Error('missing');
    return { isFile: () => true };
  });
}

describe('trusted Git executable', () => {
  it('uses an absolute Linux system binary despite a poisoned PATH', () => {
    installedAt('/usr/bin/git');
    expect(resolveGitExecutable('linux', { PATH: './attacker' })).toBe('/usr/bin/git');
    expect(accessSync).toHaveBeenCalledWith('/usr/bin/git', 1);
  });

  it('supports Homebrew on macOS', () => {
    installedAt('/opt/homebrew/bin/git');
    expect(resolveGitExecutable('darwin', {})).toBe('/opt/homebrew/bin/git');
  });

  it('supports Git installed in Windows Program Files on another drive', () => {
    installedAt('E:\\Program Files\\Git\\cmd\\git.exe');
    expect(resolveGitExecutable('win32', { ProgramFiles: 'E:\\Program Files' }))
      .toBe('E:\\Program Files\\Git\\cmd\\git.exe');
  });

  it('rejects checkout and relative install directories without a PATH fallback', () => {
    installedAt('repo\\Git\\cmd\\git.exe');
    expect(() => resolveGitExecutable('win32', { ProgramFiles: 'repo', PATH: 'repo' }))
      .toThrow(/directorio de sistema confiable/);
  });

  it('rejects directories and files without executable permissions', () => {
    vi.mocked(statSync).mockReturnValue({ isFile: () => false });
    expect(() => resolveGitExecutable('linux', {})).toThrow();
    vi.mocked(statSync).mockReturnValue({ isFile: () => true });
    vi.mocked(accessSync).mockImplementation(() => { throw new Error('permission denied'); });
    expect(() => resolveGitExecutable('linux', {})).toThrow();
  });
});
