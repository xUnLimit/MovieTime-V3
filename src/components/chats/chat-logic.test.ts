import { describe, expect, it } from 'vitest';

import type { WhatsAppChatMessage, WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';
import type { MetaTemplateInfo } from '@/modules/messaging/meta-template-mapping';
import type { TemplateMensaje } from '@/types';
import { avatarHue, initialsFor } from './chat-format';
import { buildMetaTemplateParams, buildTemplateOptions, suggestTipoByDueDate } from './chat-templates';
import { buildTimeline, dayLabel } from './chat-timeline';
import {
  activeConversationCategories,
  categoryFilterId,
  countByFilter,
  daysUntil,
  isDueSoon,
  matchesFilter,
  matchesSearch,
  parseDateOnly,
  sortConversations,
} from './conversation-filters';

const NOW = new Date(2026, 8, 27, 15, 30);

function conversation(overrides: Partial<WhatsAppConversation> = {}): WhatsAppConversation {
  return {
    waId: '50760000000', contactName: 'Mary', terceroId: 't1', terceroNombre: 'María Pérez',
    lastDirection: 'inbound', lastPreview: 'Ya pagué', lastMessageAt: NOW.toISOString(),
    lastInboundAt: new Date(2026, 8, 27, 14, 0).toISOString(), unreadCount: 0, nextExpiry: null,
    activeCategories: [], pinnedAt: null, archived: false,
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
    expect(countByFilter([unread, unregistered, due], NOW)).toEqual({ todos: 3, no_leidos: 1, ventana_abierta: 2, sin_registrar: 1, archivados: 0 });
  });

  it('keeps archived chats out of every filter except their own', () => {
    const archived = conversation({ waId: '9', archived: true, unreadCount: 1, activeCategories: ['Netflix'] });
    const active = conversation({ waId: '1' });

    expect(matchesFilter(archived, 'archivados', NOW)).toBe(true);
    expect(matchesFilter(active, 'archivados', NOW)).toBe(false);
    for (const filter of ['todos', 'no_leidos', 'ventana_abierta', 'sin_registrar', categoryFilterId('Netflix')] as const) {
      expect(matchesFilter(archived, filter, NOW)).toBe(false);
    }
    expect(countByFilter([archived, active], NOW)).toMatchObject({ todos: 1, no_leidos: 0, archivados: 1 });
  });

  it('puts pinned chats first, latest pin first, keeping the rest in order', () => {
    const a = conversation({ waId: 'a' });
    const b = conversation({ waId: 'b', pinnedAt: '2026-09-29T10:00:00Z' });
    const c = conversation({ waId: 'c' });
    const d = conversation({ waId: 'd', pinnedAt: '2026-09-30T10:00:00Z' });
    const input = [a, b, c, d];

    expect(sortConversations(input).map((item) => item.waId)).toEqual(['d', 'b', 'a', 'c']);
    expect(input.map((item) => item.waId)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('auto-tags a client by their active services and filters/counts by category', () => {
    const netflixOnly = conversation({ waId: '1', activeCategories: ['Netflix'] });
    const both = conversation({ waId: '2', activeCategories: ['Crunchyroll', 'Netflix'] });
    const none = conversation({ waId: '3', activeCategories: [] });

    expect(activeConversationCategories([netflixOnly, both, none])).toEqual(['Crunchyroll', 'Netflix']);
    expect(matchesFilter(netflixOnly, categoryFilterId('Netflix'), NOW)).toBe(true);
    expect(matchesFilter(both, categoryFilterId('Netflix'), NOW)).toBe(true);
    expect(matchesFilter(none, categoryFilterId('Netflix'), NOW)).toBe(false);
    expect(countByFilter([netflixOnly, both, none], NOW)).toMatchObject({
      'categoria:Netflix': 2,
      'categoria:Crunchyroll': 1,
    });
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
  const map = ['saludo_nombre', 'servicios', 'vencimiento', 'monto_total'];

  it('fills the Meta params of a tipo from the sale using its map', () => {
    expect(buildMetaTemplateParams({ metaParamMap: map }, context, 'X', 'Buenas tardes'))
      .toEqual(['Buenas tardes, María', 'Netflix', '30 de septiembre de 2026', '$4.50']);
    expect(buildMetaTemplateParams({ metaParamMap: ['servicios', 'nombre_cliente'] }, context, 'X', 'Buenas tardes'))
      .toEqual(['Netflix', 'María']);
  });

  it('only pre-fills the name-based values without a sale', () => {
    expect(buildMetaTemplateParams({ metaParamMap: map }, null, 'Allan Ordoñez', 'Buenos días'))
      .toEqual(['Buenos días, Allan', '', '', '']);
    expect(buildMetaTemplateParams({ metaParamMap: ['servicios'] }, null, '', 'Buenos días')).toEqual(['']);
    expect(buildMetaTemplateParams({}, context, 'X', 'Buenos días')).toEqual([]);
  });

  it('suggests the tipo by due date', () => {
    expect(suggestTipoByDueDate(null, NOW)).toBe('dia_pago');
    expect(suggestTipoByDueDate(new Date(2026, 8, 30), NOW)).toBe('dia_pago');
    expect(suggestTipoByDueDate(new Date(2026, 8, 27, 1), NOW)).toBe('dia_pago');
    expect(suggestTipoByDueDate(new Date(2026, 8, 20), NOW)).toBe('cancelacion');
  });

  it('offers only active tipos linked to an approved, non-retired Meta template, in editor order', () => {
    const tipo = (tipoKey: string, overrides: Partial<TemplateMensaje> = {}): TemplateMensaje => ({
      id: tipoKey, nombre: tipoKey, tipo: tipoKey as TemplateMensaje['tipo'], contenido: '', placeholders: [], activo: true,
      metaTemplateName: 'aviso', metaParamMap: [], createdAt: NOW, updatedAt: NOW, ...overrides,
    });
    const meta = (name: string, overrides: Partial<MetaTemplateInfo> = {}): MetaTemplateInfo => ({
      id: name, name, language: 'es', status: 'APPROVED', category: 'UTILITY', body: 'Hola', header: null, footer: null,
      buttons: [], paramCount: 0, retired: false, syncedAt: NOW.toISOString(), ...overrides,
    });
    const options = buildTemplateOptions(
      [
        tipo('cancelacion', { metaTemplateName: 'corte' }),
        tipo('dia_pago'),
        tipo('despedida', { metaTemplateName: null }),
        tipo('renovacion', { metaTemplateName: 'pendiente' }),
        tipo('suscripcion', { metaTemplateName: 'viejo' }),
        tipo('notificacion_regular', { activo: false }),
      ],
      [meta('aviso'), meta('corte'), meta('pendiente', { status: 'PENDING' }), meta('viejo', { retired: true })],
    );
    expect(options.map((item) => item.tipo.tipo)).toEqual(['dia_pago', 'cancelacion']);
    expect(options[1]?.meta.name).toBe('corte');
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
