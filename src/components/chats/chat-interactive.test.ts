import { describe, expect, it } from 'vitest';

import type { WhatsAppChatMessage } from '@/application/use-cases/whatsapp-chat-use-cases';
import {
  buildInteractiveMessage,
  emptyInteractiveDraft,
  isInteractiveKind,
  readInteractiveOptions,
  rebuildInteractiveMessage,
  type InteractiveDraft,
} from './chat-interactive';

const buttonsDraft = (titles: string[], body = '¿Qué deseas hacer?'): InteractiveDraft => ({
  type: 'buttons', body, buttonLabel: '', options: titles.map((title) => ({ title, description: '' })),
});
const listDraft = (overrides: Partial<InteractiveDraft> = {}): InteractiveDraft => ({
  type: 'list', body: 'Elige un plan', buttonLabel: 'Ver planes',
  options: [{ title: 'Netflix 1 mes', description: '$4.50' }, { title: 'Disney 1 mes', description: '' }], ...overrides,
});
const baseMessage: WhatsAppChatMessage = {
  id: 'm1', waMessageId: 'wa-1', direction: 'outbound', kind: 'interactive', textBody: 'Elige', templateName: null,
  occurredAt: '2026-09-27T20:00:00.000Z', status: 'failed', mediaId: null, mediaMimeType: null, mediaFilename: null,
  contextWaMessageId: null, reactionEmoji: null, payload: {},
};

describe('buildInteractiveMessage', () => {
  it('builds reply buttons with system ids and trimmed titles', () => {
    expect(buildInteractiveMessage(buttonsDraft([' Ya pagué ', 'Ver planes']))).toEqual({ ok: true, message: {
      kind: 'buttons', body: '¿Qué deseas hacer?', buttons: [{ id: 'btn-1', title: 'Ya pagué' }, { id: 'btn-2', title: 'Ver planes' }],
    } });
  });
  it('builds a list and omits empty descriptions', () => {
    expect(buildInteractiveMessage(listDraft())).toEqual({ ok: true, message: {
      kind: 'list', body: 'Elige un plan', buttonLabel: 'Ver planes',
      rows: [{ id: 'row-1', title: 'Netflix 1 mes', description: '$4.50' }, { id: 'row-2', title: 'Disney 1 mes' }],
    } });
  });
  it.each([
    [buttonsDraft(['Sí'], '  '), 'Escribe el texto del mensaje.'],
    [buttonsDraft(['Sí'], 'x'.repeat(1025)), 'El texto no puede superar 1024 caracteres.'],
    [buttonsDraft([]), 'Agrega entre 1 y 3 botones.'],
    [buttonsDraft(['A', 'B', 'C', 'D']), 'Agrega entre 1 y 3 botones.'],
    [buttonsDraft(['Sí', ' ']), 'Cada botón necesita un título.'],
    [buttonsDraft(['x'.repeat(21)]), 'Cada título de botón admite hasta 20 caracteres.'],
    [buttonsDraft(['Sí', ' sí']), 'No repitas títulos: WhatsApp los rechaza.'],
    [listDraft({ buttonLabel: ' ' }), 'Escribe el texto del botón que abre la lista.'],
    [listDraft({ buttonLabel: 'x'.repeat(21) }), 'El botón de la lista admite hasta 20 caracteres.'],
    [listDraft({ options: [{ title: 'x'.repeat(25), description: '' }] }), 'Cada título de opción admite hasta 24 caracteres.'],
    [listDraft({ options: [{ title: 'Plan', description: 'x'.repeat(73) }] }), 'Cada descripción admite hasta 72 caracteres.'],
    [listDraft({ options: Array.from({ length: 11 }, (_, index) => ({ title: `Plan ${index}`, description: '' })) }), 'Agrega entre 1 y 10 opciones.'],
  ])('rejects invalid drafts (%#)', (draft, error) => {
    expect(buildInteractiveMessage(draft)).toEqual({ ok: false, error });
  });
  it('starts drafts with one empty option and a default list label', () => {
    expect(emptyInteractiveDraft('buttons')).toEqual({ type: 'buttons', body: '', buttonLabel: '', options: [{ title: '', description: '' }] });
    expect(emptyInteractiveDraft('list').buttonLabel).toBe('Ver opciones');
  });
});

describe('stored interactive messages', () => {
  it('reads buttons and list payloads and ignores malformed ones', () => {
    expect(readInteractiveOptions({ buttons: [{ id: 'btn-1', title: 'Sí' }] })).toEqual({ type: 'buttons', buttons: [{ id: 'btn-1', title: 'Sí' }] });
    expect(readInteractiveOptions({ buttonLabel: 'Ver', rows: [{ id: 'row-1', title: 'Plan', description: 'd' }] }))
      .toEqual({ type: 'list', buttonLabel: 'Ver', rows: [{ id: 'row-1', title: 'Plan', description: 'd' }] });
    expect(readInteractiveOptions({ buttons: [] })).toBeNull();
    expect(readInteractiveOptions({ rows: [{ id: 'x' }] })).toBeNull();
    expect(readInteractiveOptions(null)).toBeNull();
  });
  it('recognizes stored and pending interactive kinds', () => {
    expect(['interactive', 'buttons', 'list', 'text'].map(isInteractiveKind)).toEqual([true, true, true, false]);
  });
  it('rebuilds a failed message for retry, keeping its quoted reply', () => {
    expect(rebuildInteractiveMessage({ ...baseMessage, contextWaMessageId: 'wa-quoted', payload: { buttons: [{ id: 'btn-1', title: 'Sí' }] } }))
      .toEqual({ kind: 'buttons', body: 'Elige', buttons: [{ id: 'btn-1', title: 'Sí' }], replyTo: 'wa-quoted' });
    expect(rebuildInteractiveMessage({ ...baseMessage, payload: { buttonLabel: 'Ver', rows: [{ id: 'row-1', title: 'Plan' }] } }))
      .toEqual({ kind: 'list', body: 'Elige', buttonLabel: 'Ver', rows: [{ id: 'row-1', title: 'Plan' }] });
  });
  it('cannot rebuild without text, options or an interactive kind', () => {
    const payload = { buttons: [{ id: 'btn-1', title: 'Sí' }] };
    expect(rebuildInteractiveMessage({ ...baseMessage, textBody: null, payload })).toBeNull();
    expect(rebuildInteractiveMessage({ ...baseMessage, kind: 'text', payload })).toBeNull();
    expect(rebuildInteractiveMessage(baseMessage)).toBeNull();
  });
});
