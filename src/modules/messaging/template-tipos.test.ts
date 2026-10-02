import { describe, expect, it } from 'vitest';

import { TEMPLATE_TIPOS, isEditableTipo } from './template-tipos';

describe('isEditableTipo', () => {
  it('accepts every editable tipo', () => {
    for (const item of TEMPLATE_TIPOS) expect(isEditableTipo(item.value)).toBe(true);
  });

  it('rejects the retired tipo, unknown text and non strings', () => {
    expect(isEditableTipo('notificacion_regular')).toBe(false);
    expect(isEditableTipo('inventado')).toBe(false);
    expect(isEditableTipo('')).toBe(false);
    expect(isEditableTipo(null)).toBe(false);
    expect(isEditableTipo(undefined)).toBe(false);
    expect(isEditableTipo(3)).toBe(false);
  });
});
