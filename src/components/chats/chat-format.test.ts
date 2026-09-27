import { describe, expect, it } from 'vitest';

import {
  conversationTitle,
  formatChatTime,
  formatWaId,
  getServiceWindow,
  messagePreview,
  statusLabel,
} from './chat-format';

const NOW = new Date(2026, 8, 27, 15, 30);

describe('chat format helpers', () => {
  it('prefers the tercero name, then the WhatsApp profile, then the number', () => {
    expect(conversationTitle({ terceroNombre: 'María Pérez', contactName: 'Mary', waId: '50760000000' })).toBe('María Pérez');
    expect(conversationTitle({ terceroNombre: null, contactName: 'Mary', waId: '50760000000' })).toBe('Mary');
    expect(conversationTitle({ terceroNombre: null, contactName: null, waId: '50760000000' })).toBe('+507 6000-0000');
  });

  it('formats Panama and foreign numbers', () => {
    expect(formatWaId('50765331751')).toBe('+507 6533-1751');
    expect(formatWaId('14155550100')).toBe('+14155550100');
  });

  it('shows the time today, "ayer" and a date otherwise', () => {
    expect(formatChatTime(new Date(2026, 8, 27, 9, 5).toISOString(), NOW)).toBe('09:05');
    expect(formatChatTime(new Date(2026, 8, 26, 9, 5).toISOString(), NOW)).toBe('ayer');
    expect(formatChatTime(new Date(2026, 8, 20, 9, 5).toISOString(), NOW)).toBe('20/09/26');
  });

  it('computes the remaining 24 hour customer service window', () => {
    expect(getServiceWindow(null, NOW)).toEqual({ open: false });
    expect(getServiceWindow(new Date(2026, 8, 27, 14, 30).toISOString(), NOW)).toEqual({ open: true, hoursLeft: 23 });
    expect(getServiceWindow(new Date(2026, 8, 26, 15, 40).toISOString(), NOW)).toEqual({ open: true, hoursLeft: 1 });
    expect(getServiceWindow(new Date(2026, 8, 26, 15, 30).toISOString(), NOW)).toEqual({ open: false });
    expect(getServiceWindow(new Date(2026, 8, 28, 15, 30).toISOString(), NOW)).toEqual({ open: false });
  });

  it('labels delivery statuses and keeps unknown ones', () => {
    expect(statusLabel('read')).toBe('Leído');
    expect(statusLabel('failed')).toBe('No entregado');
    expect(statusLabel('weird')).toBe('weird');
  });

  it('previews text, templates and media messages', () => {
    expect(messagePreview('text', 'Hola', null)).toBe('Hola');
    expect(messagePreview('template', null, 'vence_hoy')).toBe('Plantilla: Vence hoy');
    expect(messagePreview('template', null, 'otra')).toBe('Plantilla: otra');
    expect(messagePreview('image', null, null)).toBe('Imagen');
    expect(messagePreview('reaction', null, null)).toBe('Reaccionó');
    expect(messagePreview('interactive', null, null)).toBe('Mensaje interactivo');
    expect(messagePreview('location', null, null)).toBe('Ubicación');
    expect(messagePreview('contacts', null, null)).toBe('Contacto');
  });
});
