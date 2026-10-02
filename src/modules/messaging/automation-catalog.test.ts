import { describe, expect, it } from 'vitest';

import { AUTOMATION_CATALOG, TRIGGER_LABELS } from './automation-catalog';
import { TEMPLATE_GROUPS, TEMPLATE_TIPOS } from './template-tipos';

describe('AUTOMATION_CATALOG', () => {
  it('covers every editable tipo and nothing else', () => {
    expect(Object.keys(AUTOMATION_CATALOG).sort()).toEqual(TEMPLATE_TIPOS.map((item) => item.value).sort());
  });

  it('gives each tipo at least one known trigger and a detail', () => {
    for (const info of Object.values(AUTOMATION_CATALOG)) {
      expect(info.triggers.length).toBeGreaterThan(0);
      for (const trigger of info.triggers) expect(TRIGGER_LABELS[trigger]).toBeTruthy();
      expect(info.detail.trim()).not.toBe('');
    }
  });

  it('is consistent with the editor groups', () => {
    const grouped = TEMPLATE_GROUPS.flatMap((group) => group.tipos).sort();
    expect(grouped).toEqual(Object.keys(AUTOMATION_CATALOG).sort());
  });

  it('marks the button reply messages as customer triggered and the daily notice as cron', () => {
    expect(AUTOMATION_CATALOG.datos_pago.triggers).toEqual(['respuesta']);
    expect(AUTOMATION_CATALOG.despedida.triggers).toEqual(['respuesta']);
    expect(AUTOMATION_CATALOG.dia_pago.triggers).toContain('cron');
    expect(AUTOMATION_CATALOG.cancelacion.triggers).toEqual(['manual']);
  });
});
