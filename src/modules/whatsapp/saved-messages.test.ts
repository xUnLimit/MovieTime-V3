import { describe, expect, it } from 'vitest';

import { emptySavedMessageDraft, parseSavedMessage, validateSavedMessageDraft } from './saved-messages';

const draft = { ...emptySavedMessageDraft(), title: 'Bienvenida', body: 'Hola, ¿en qué podemos ayudarte?' };

describe('saved chat messages', () => {
  it('normalizes plain text without carrying interactive fields', () => {
    expect(validateSavedMessageDraft({ ...draft, title: ' Bienvenida ', body: ' Hola ', options: [{ title: 'Viejo', description: '' }] })).toEqual({
      ok: true,
      value: { title: 'Bienvenida', kind: 'text', body: 'Hola', buttonLabel: '', options: [] },
    });
  });

  it('accepts text with buttons and removes unused descriptions', () => {
    expect(validateSavedMessageDraft({ ...draft, kind: 'buttons', options: [{ title: ' Sí ', description: 'ignorada' }, { title: 'No', description: '' }] })).toEqual({
      ok: true,
      value: { title: 'Bienvenida', kind: 'buttons', body: draft.body, buttonLabel: '', options: [{ title: 'Sí', description: '' }, { title: 'No', description: '' }] },
    });
  });

  it('accepts text with list choices and descriptions', () => {
    expect(validateSavedMessageDraft({ ...draft, kind: 'list', buttonLabel: ' Planes ', options: [{ title: ' Mensual ', description: 'Un mes' }] })).toEqual({
      ok: true,
      value: { title: 'Bienvenida', kind: 'list', body: draft.body, buttonLabel: 'Planes', options: [{ title: 'Mensual', description: 'Un mes' }] },
    });
  });

  it('rejects incomplete, duplicate and overlong interactive content', () => {
    expect(validateSavedMessageDraft({ ...draft, body: ' ' })).toMatchObject({ ok: false });
    expect(validateSavedMessageDraft({ ...draft, kind: 'buttons', options: [{ title: 'Sí', description: '' }, { title: ' sí ', description: '' }] })).toMatchObject({ ok: false, error: 'Los títulos de las opciones no pueden repetirse.' });
    expect(validateSavedMessageDraft({ ...draft, kind: 'list', options: [{ title: 'Uno', description: 'x'.repeat(73) }] })).toMatchObject({ ok: false });
    expect(validateSavedMessageDraft({ ...draft, kind: 'buttons', body: 'x'.repeat(1025) })).toMatchObject({ ok: false });
  });

  it('rejects malformed stored records before showing them in chat', () => {
    const row = { ...draft, options: [], buttonLabel: null, id: '11111111-1111-4111-8111-111111111111', createdBy: '22222222-2222-4222-8222-222222222222', createdAt: '2026-09-27', updatedAt: '2026-09-27' };
    expect(parseSavedMessage(row)).toMatchObject({ id: row.id, kind: 'text', body: draft.body });
    expect(() => parseSavedMessage({ ...row, kind: 'buttons' })).toThrow('Invalid stored chat message');
  });
});
