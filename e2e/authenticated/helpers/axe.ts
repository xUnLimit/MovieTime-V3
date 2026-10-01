import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Mismo criterio que el gate anonimo (production-gates): sin impactos serios ni criticos WCAG 2.x A/AA. */
export async function expectNoBlockingA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}
