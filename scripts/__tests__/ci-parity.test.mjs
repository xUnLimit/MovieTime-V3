// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkCiParity } from '../lib/ci-parity.mjs';

describe('paridad de CI', () => {
  it('acepta comandos presentes en workflows distintos', () => {
    expect(checkCiParity('npm run typecheck && npm run test:coverage', {
      'quality.yml': 'run: npm run typecheck',
      'tests.yml': 'run: npm run test:coverage',
    })).toEqual([]);
  });

  it('identifica el comando ausente en CI', () => {
    expect(checkCiParity('npm run typecheck && npm run migrate:lint', {
      'quality.yml': 'run: npm run typecheck',
    })).toContain('quality.yml y demas workflows: falta npm run migrate:lint (equivalencia: migrate:lint).');
  });

  it('rechaza comandos adicionales sin documentar e indica el workflow', () => {
    expect(checkCiParity('npm run typecheck', {
      'extra.yml': 'run: npm run typecheck && npm run inventado',
    })).toContain('extra.yml: npm run inventado no figura en quality:full ni en los exclusivos de CI.');
  });

  it('acepta las equivalencias declaradas de navegador y Lighthouse', () => {
    expect(checkCiParity('npm run test:e2e && npm run test:a11y && npm run test:performance && npm run test:lighthouse', {
      'quality.yml': 'run: npm run test:browser\n- uses: treosh/lighthouse-ci-action@version',
    })).toEqual([]);
  });

  it('lee package.json y workflows de un repositorio temporal', () => {
    const root = mkdtempSync(join(tmpdir(), 'ci-parity-'));
    try {
      mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
      writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { 'quality:full': 'npm run typecheck' } }));
      writeFileSync(join(root, '.github', 'workflows', 'quality.yml'), 'steps:\n  - run: npm run typecheck\n');
      const output = execFileSync('node', [join(import.meta.dirname, '..', 'check-ci-parity.mjs')], {
        cwd: root, encoding: 'utf8',
      });
      expect(output.trim()).toBe('CI parity passed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
