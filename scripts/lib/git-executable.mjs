import { accessSync, constants, statSync } from 'node:fs';
import { win32 } from 'node:path';

// Never execute a Git binary selected by PATH (which can include the checkout).
export function resolveGitExecutable(platform = process.platform, environment = process.env) {
  let candidates = ['/usr/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git'];
  if (platform === 'win32') {
    const roots = [environment.ProgramFiles, environment['ProgramFiles(x86)'],
      'C:\\Program Files', 'D:\\Program Files'];
    candidates = roots.filter((root) => typeof root === 'string'
      && /^[A-Za-z]:\\Program Files(?: \(x86\))?$/i.test(root))
      .flatMap((root) => ['cmd', 'bin'].map((directory) => win32.join(root, 'Git', directory, 'git.exe')));
  }
  for (const candidate of candidates) {
    try {
      if (!statSync(candidate).isFile()) continue;
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next trusted installation directory.
    }
  }
  throw new Error('Git no esta instalado en un directorio de sistema confiable.');
}
