import { describe, expect, it } from 'vitest';

import { hasValidTemplateParams, WHATSAPP_TEMPLATE_NAMES } from './template-catalog';

describe('template catalog', () => {
  it('lists the templates approved for the account', () => {
    expect(WHATSAPP_TEMPLATE_NAMES).toEqual(['recordatorio_vencimiento', 'vence_hoy', 'servicio_suspendido']);
  });

  it.each([
    ['recordatorio_vencimiento', 4],
    ['vence_hoy', 3],
    ['servicio_suspendido', 4],
  ] as const)('requires exactly the registered parameters for %s', (name, count) => {
    expect(hasValidTemplateParams(name, Array.from({ length: count }, () => 'x'))).toBe(true);
    expect(hasValidTemplateParams(name, Array.from({ length: count - 1 }, () => 'x'))).toBe(false);
  });
});
