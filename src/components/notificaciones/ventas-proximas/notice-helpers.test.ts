import { describe, expect, it } from 'vitest';

import {
  buildNoticePreview, resolveResultWaMe, groupNotificationsByTipo, needsWaMeFallback, noticeBadgeInfo,
  noticeReasonLabel, noticeTipoFor, summarizeNoticeResults,
} from './notice-helpers';
import type { NotificacionVentaConId } from './types';

const notif = (over: Partial<NotificacionVentaConId>) => ({
  id: 'n', ventaId: 'v', clienteId: 'c', clienteNombre: 'Ana Pérez', categoriaNombre: 'Netflix', servicioNombre: 'Netflix',
  diasRestantes: 3, fechaFin: new Date(2026, 9, 1), precioFinal: 10, moneda: 'USD', ...over,
} as NotificacionVentaConId);

describe('notice tipo rules', () => {
  it('uses dia_pago on or after the due date and regular before', () => {
    expect(noticeTipoFor(0)).toBe('dia_pago');
    expect(noticeTipoFor(-2)).toBe('dia_pago');
    expect(noticeTipoFor(1)).toBe('notificacion_regular');
  });

  it('groups selected ventas by rule tipo', () => {
    const groups = groupNotificationsByTipo([
      notif({ id: '1', ventaId: 'a', diasRestantes: 0 }),
      notif({ id: '2', ventaId: 'b', diasRestantes: 5 }),
      notif({ id: '3', ventaId: 'c', diasRestantes: -1 }),
    ]);
    expect(groups).toEqual([
      { tipo: 'dia_pago', ventaIds: ['a', 'c'] },
      { tipo: 'notificacion_regular', ventaIds: ['b'] },
    ]);
  });
});

describe('badge mapping', () => {
  const state = (badge: 'read' | 'sent' | 'pending' | 'failed' | 'delivered' | null) => ({
    noticeId: 'n', tipo: 'dia_pago', badge, createdAt: '2026-09-28T15:00:00Z', noContinuar: false, noContinuarAt: null,
  });
  it.each([
    ['sent', 'Enviado'], ['delivered', 'Entregado'], ['read', 'Leído'], ['failed', 'Falló'], ['pending', 'Pendiente'],
  ] as const)('%s -> %s', (badge, label) => {
    expect(noticeBadgeInfo(state(badge))?.label).toBe(label);
    expect(noticeBadgeInfo(state(badge))?.dateLabel).toBeTruthy();
  });
  it('has no badge without a notice', () => {
    expect(noticeBadgeInfo(undefined)).toBeNull();
    expect(noticeBadgeInfo(state(null))).toBeNull();
  });
});

describe('results', () => {
  const result = (status: 'accepted' | 'already_sent' | 'failed' | 'skipped' | 'uncertain' | 'wa_me') => ({
    noticeId: null, clienteNombre: 'X', ventaIds: ['v'], status, channel: null, waId: null,
  });
  it('summarizes by status and flags fallbacks', () => {
    const summary = summarizeNoticeResults((['accepted', 'already_sent', 'failed', 'skipped', 'uncertain', 'wa_me'] as const).map(result));
    expect(Object.values(summary).map((list) => list.length)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(needsWaMeFallback('failed')).toBe(true);
    expect(needsWaMeFallback('skipped')).toBe(true);
    expect(needsWaMeFallback('wa_me')).toBe(true);
    expect(needsWaMeFallback('accepted')).toBe(false);
    expect(needsWaMeFallback('uncertain')).toBe(false);
  });
  it('explains skip reasons', () => {
    expect(noticeReasonLabel({ error: 'no_continuar' })).toContain('no desea continuar');
    expect(noticeReasonLabel({ error: 'algo raro' })).toBe('algo raro');
    expect(noticeReasonLabel({})).toBe('Sin detalle');
  });
});

describe('preview', () => {
  it('renders the free text for the row', () => {
    expect(buildNoticePreview(notif({}), 'Hola {cliente}, {servicio}')).toContain('Hola Ana Pérez, Netflix');
  });
});

describe('resolveResultWaMe', () => {
  const ventas = [
    notif({ id: '1', ventaId: 'a', categoriaNombre: 'Netflix', servicioNombre: 'Netflix', clienteTelefono: '60001111' }),
    notif({ id: '2', ventaId: 'b', categoriaNombre: 'Disney+', servicioNombre: 'Disney+', clienteTelefono: '60001111' }),
  ];
  const contenido = 'Hola {cliente}:\n{{#items}}- {servicio}\n{{/items}}';

  it('prefers the server text when present', () => {
    expect(resolveResultWaMe({ ventaIds: ['a', 'b'], waMeText: 'del servidor' }, ventas, contenido)).toEqual({ phone: '60001111', text: 'del servidor' });
  });

  it('renders every venta of a grouped result locally', () => {
    const resolved = resolveResultWaMe({ ventaIds: ['a', 'b'] }, ventas, contenido);
    expect(resolved?.text).toContain('- Netflix');
    expect(resolved?.text).toContain('- Disney+');
  });

  it('returns null for a single venta without server text so the existing flow is used', () => {
    expect(resolveResultWaMe({ ventaIds: ['a'] }, ventas, contenido)).toBeNull();
    expect(resolveResultWaMe({ ventaIds: ['a', 'b'] }, ventas, undefined)).toBeNull();
  });
});
