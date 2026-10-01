import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflowDirectory = join(process.cwd(), '.github', 'workflows');
const workflows = readdirSync(workflowDirectory)
  .filter((file) => file.endsWith('.yml'))
  .map((file) => [file, readFileSync(join(workflowDirectory, file), 'utf8')]);

describe('workflow supply chain and secret handling', () => {
  it.each(workflows)('%s disables lifecycle scripts while installing dependencies', (_, source) => {
    const installs = [...source.matchAll(/\bnpm ci[^\r\n]*/g)].map(([command]) => command);
    for (const command of installs) expect(command).toContain('--ignore-scripts');
  });

  it.each(workflows)('%s uses local binaries or a pinned package without lifecycle scripts', (_, source) => {
    const executions = [...source.matchAll(/\bnpx ([^\r\n]*)/g)].map(([, command]) => command);
    for (const command of executions) {
      if (command.includes('--no-install')) continue;
      expect(command).toContain('--ignore-scripts');
      expect(command).toMatch(/\b[\w-]+@\d+\.\d+\.\d+\b/);
    }
  });

  it.each(workflows)('%s does not interpolate GitHub secrets in shell code', (_, source) => {
    const lines = source.split(/\r?\n/);
    let runIndent = null;
    for (const line of lines) {
      const indent = line.length - line.trimStart().length;
      if (line.trim().length === 0) continue;
      if (runIndent !== null && indent <= runIndent) runIndent = null;
      if (/^(?:- )?run:/.test(line.trimStart())) runIndent = indent;
      if (runIndent !== null) expect(line).not.toContain('${{ secrets.');
    }
  });
});
