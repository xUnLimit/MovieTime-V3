import { describe, expect, it } from 'vitest';

import type { WhatsAppChatMessage, WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';
import { avatarHue, initialsFor, renderTemplatePreview } from './chat-format';
import { buildMetaTemplateParams, quickRepliesFrom, suggestMetaTemplate } from './chat-templates';
import { buildTimeline, dayLabel } from './chat-timeline';
import {
  countByFilter,
  daysUntil,
  isDueSoon,
  matchesFilter,
  matchesSearch,
  parseDateOnly,
} from './conversation-filters';
import type { TemplateMensaje } from '@/types';

const NOW = new Date(2026, 8, 27, 15, 30);

function conversation(overrides: Partial<WhatsAppConversation> = {}): WhatsAppConversation {
  return {
    waId: '50760000000', contactName: 'Mary', terceroId: 't1', terceroNombre: 'María Pérez',
    lastDirection: 'inbound', lastPreview: 'Ya pagué', lastMessageAt: NOW.toISOString(),
    lastInboundAt: new Date(2026, 8, 27, 14, 0).toISOString(), unreadCount: 0, nextExpiry: null,
    ...overrides,
  };
}

function message(id: string, direction: 'inbound' | 'outbound', at: Date): WhatsAppChatMessage {
  return {
    id, direction, kind: 'text', textBody: id, templateName: null, occurredAt: at.toISOString(),
    status: direction === 'inbound' ? 'received' : 'read', mediaId: null, mediaMimeType: null, mediaFilename: null,
    waMessageId: id, contextWaMessageId: null, reactionEmoji: null, payload: {},
  };
}

const context = {
  clienteNombre: 'María Pérez', categoriaNombre: 'Netflix', servicioNombre: 'Netflix 01', perfilNombre: 'María',
  correo: 'cuenta@example.com', contrasena: 'clave-demo', codigo: '1234', fechaVencimiento: new Date(2026, 8, 30), monto: 4.5,
};

describe('conversation filters', () => {
  it('parses date-only values in local time and counts days', () => {
    expect(parseDateOnly('2026-09-30')).toEqual(new Date(2026, 8, 30));
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly('garbage')).toBeNull();
    expect(daysUntil(new Date(2026, 8, 30), NOW)).toBe(3);
  });

  it('treats expiries from a week ago up to three days ahead as due soon', () => {
    expect(isDueSoon({ nextExpiry: '2026-09-30' }, NOW)).toBe(true);
    expect(isDueSoon({ nextExpiry: '2026-09-20' }, NOW)).toBe(true);
    expect(isDueSoon({ nextExpiry: '2026-10-01' }, NOW)).toBe(false);
    expect(isDueSoon({ nextExpiry: '2026-09-19' }, NOW)).toBe(false);
    expect(isDueSoon({ nextExpiry: null }, NOW)).toBe(false);
  });

  it('matches each filter', () => {
    const unread = conversation({ unreadCount: 2 });
    const unregistered = conversation({ terceroId: null, lastInboundAt: null });
    const due = conversation({ nextExpiry: '2026-09-28' });

    expect(matchesFilter(unread, 'no_leidos', NOW)).toBe(true);
    expect(matchesFilter(due, 'no_leidos', NOW)).toBe(false);
    expect(matchesFilter(unread, 'ventana_abierta', NOW)).toBe(true);
    expect(matchesFilter(unregistered, 'ventana_abierta', NOW)).toBe(false);
    expect(matchesFilter(unregistered, 'sin_registrar', NOW)).toBe(true);
    expect(matchesFilter(unread, 'sin_registrar', NOW)).toBe(false);
    expect(matchesFilter(unread, 'todos', NOW)).toBe(true);
    expect(countByFilter([unread, unregistered, due], NOW)).toEqual({ todos: 3, no_leidos: 1, ventana_abierta: 2, sin_registrar: 1 });
  });

  it('searches by name, number digits and last message', () => {
    const item = conversation();
    expect(matchesSearch(item, '')).toBe(true);
    expect(matchesSearch(item, 'maría')).toBe(true);
    expect(matchesSearch(item, '6000-0000')).toBe(true);
    expect(matchesSearch(item, 'pagué')).toBe(true);
    expect(matchesSearch(item, 'hbo')).toBe(false);
  });
});

describe('chat timeline', () => {
  it('labels days like WhatsApp', () => {
    expect(dayLabel(NOW, NOW)).toBe('Hoy');
    expect(dayLabel(new Date(2026, 8, 26), NOW)).toBe('Ayer');
    expect(dayLabel(new Date(2026, 8, 23), NOW)).toBe('Miércoles');
    expect(dayLabel(new Date(2026, 7, 1), NOW)).toBe('1 de agosto de 2026');
  });

  it('adds day separators, groups nearby bubbles and marks the first unread message', () => {
    const items = buildTimeline([
      message('a', 'inbound', new Date(2026, 8, 26, 10, 0)),
      message('b', 'outbound', new Date(2026, 8, 27, 9, 0)),
      message('c', 'outbound', new Date(2026, 8, 27, 9, 2)),
      message('d', 'inbound', new Date(2026, 8, 27, 9, 3)),
      message('e', 'inbound', new Date(2026, 8, 27, 9, 4)),
    ], NOW, 2);

    expect(items.map((item) => (item.type === 'message' ? `${item.key}${item.continued ? '+' : ''}` : item.type === 'day' ? item.label : `unread:${item.count}`)))
      .toEqual(['Ayer', 'a', 'Hoy', 'b', 'c+', 'unread:2', 'd', 'e+']);
  });

  it('skips the unread marker when everything was read', () => {
    expect(buildTimeline([message('a', 'inbound', NOW)], NOW).some((item) => item.type === 'unread')).toBe(false);
  });
});

describe('chat templates', () => {
  it('fills Meta template values from the sale', () => {
    expect(buildMetaTemplateParams('recordatorio_vencimiento', context, 'X', 'Buenas tardes'))
      .toEqual(['Buenas tardes, María', 'Netflix', '30 de septiembre de 2026', '$4.50']);
    expect(buildMetaTemplateParams('vence_hoy', context, 'X', 'Buenas tardes'))
      .toEqual(['Netflix', '30 de septiembre de 2026', '$4.50']);
  });

  it('only pre-fills the greeting without a sale', () => {
    expect(buildMetaTemplateParams('servicio_suspendido', null, 'Allan Ordoñez', 'Buenos días'))
      .toEqual(['Buenos días, Allan', '', '', '']);
    expect(buildMetaTemplateParams('vence_hoy', null, '', 'Buenos días')).toEqual(['', '', '']);
  });

  it('suggests the template that matches the due date', () => {
    expect(suggestMetaTemplate(null, NOW)).toBe('recordatorio_vencimiento');
    expect(suggestMetaTemplate(new Date(2026, 8, 30), NOW)).toBe('recordatorio_vencimiento');
    expect(suggestMetaTemplate(new Date(2026, 8, 27, 1), NOW)).toBe('vence_hoy');
    expect(suggestMetaTemplate(new Date(2026, 8, 20), NOW)).toBe('servicio_suspendido');
  });

  it('builds quick replies from active editor templates in a fixed order', () => {
    const template = (tipo: TemplateMensaje['tipo'], activo = true) =>
      ({ id: tipo, nombre: tipo, tipo, contenido: `c-${tipo}`, placeholders: [], activo, createdAt: NOW, updatedAt: NOW });

    expect(quickRepliesFrom([template('renovacion'), template('dia_pago'), template('suscripcion', false)]))
      .toEqual([
        { tipo: 'dia_pago', label: 'Día de pago', contenido: 'c-dia_pago' },
        { tipo: 'renovacion', label: 'Renovación exitosa', contenido: 'c-renovacion' },
      ]);
  });

  it('previews Meta template bodies and keeps missing values visible', () => {
    expect(renderTemplatePreview('Hola {{1}}, vence {{2}}', ['María', ' '])).toBe('Hola María, vence {{2}}');
  });
});

describe('avatar helpers', () => {
  it('builds initials and a stable hue', () => {
    expect(initialsFor('María Pérez')).toBe('MP');
    expect(initialsFor('+507 6000-0000')).toBe('#');
    expect(avatarHue('507')).toBe(avatarHue('507'));
    expect(avatarHue('507')).toBeGreaterThanOrEqual(0);
    expect(avatarHue('507')).toBeLessThan(360);
  });
});
