import { describe, expect, it } from 'vitest';
import config from '../../stryker.config.mjs';

// Stryker serializa las suites instrumentadas con un unico worker de Vitest.
describe('mutation runner budgets', () => {
  it('allows the serial instrumented startup to exceed the default five minutes', () => {
    expect(config.dryRunTimeoutMinutes).toBeGreaterThan(5);
    expect(config.dryRunTimeoutMinutes).toBeLessThan(60);
  });

  it('keeps per-mutant timeouts, coverage analysis and the failure threshold', () => {
    expect(config.timeoutMS).toBe(30000);
    expect(config.coverageAnalysis).toBe('perTest');
    expect(config.thresholds.break).toBe(50);
    expect(config.vitest.configFile).toBe('vitest.config.mts');
  });
});
