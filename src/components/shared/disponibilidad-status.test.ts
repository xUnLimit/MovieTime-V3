import { describe, expect, it } from 'vitest';

import { getDisponiblesColorClass } from './disponibilidad-status';

describe('getDisponiblesColorClass', () => {
  it.each([
    [0, 0, 'text-muted-foreground'],
    [0, 4, 'text-danger'],
    [1, 4, 'text-danger'],
    [2, 4, 'text-warning'],
    [3, 4, 'text-success'],
    [4, 4, 'text-success'],
  ])('%s de %s -> %s', (disponibles, total, esperado) => {
    expect(getDisponiblesColorClass(disponibles, total)).toBe(esperado);
  });
});
