import { describe, expect, it } from 'vitest';

import { getBellIconColor, getEstadoBadge, getEstadoVencimiento } from './vencimiento-status';

describe('getEstadoVencimiento', () => {
  it.each([
    [-3, 'danger', '3 días de retraso'],
    [-1, 'danger', '1 día de retraso'],
    [0, 'danger', 'Vence hoy'],
    [1, 'warning', '1 día restante'],
    [7, 'warning', '7 días restantes'],
    [8, 'success', '8 días restantes'],
    [30, 'success', '30 días restantes'],
  ])('%s dias -> %s (%s)', (dias, tone, text) => {
    expect(getEstadoVencimiento(dias)).toEqual({ tone, text });
  });

  it('muestra los seguimientos resaltados como advertencia, incluso lejos del vencimiento', () => {
    expect(getEstadoVencimiento(-2, true).tone).toBe('warning');
    expect(getEstadoVencimiento(0, true).tone).toBe('warning');
    expect(getEstadoVencimiento(20, true).tone).toBe('warning');
  });
});

describe('getEstadoBadge', () => {
  it('devuelve las clases del tono y el texto', () => {
    expect(getEstadoBadge(-1, false)).toEqual({
      variant: 'border-danger-border bg-danger-subtle text-danger',
      text: '1 día de retraso',
    });
    expect(getEstadoBadge(20, false).variant).toBe('border-success-border bg-success-subtle text-success');
    expect(getEstadoBadge(3, true).variant).toBe('border-warning-border bg-warning-subtle text-warning');
  });
});

describe('getBellIconColor', () => {
  it('usa rojo si vence hoy o ya vencio y advertencia en el resto', () => {
    expect(getBellIconColor(-5).textColor).toBe('text-danger');
    expect(getBellIconColor(0).textColor).toBe('text-danger');
    expect(getBellIconColor(1).textColor).toBe('text-warning');
    expect(getBellIconColor(40).bgColor).toBe('bg-warning-subtle');
  });
});
