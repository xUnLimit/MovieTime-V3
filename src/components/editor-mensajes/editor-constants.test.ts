import { describe, expect, it } from 'vitest';

import { insertAtCursor, placeholderGroupsFor, wrapSelection } from './editor-constants';

describe('wrapSelection', () => {
  it('wraps the selected text with the WhatsApp mark and keeps it selected', () => {
    expect(wrapSelection('Hola mundo', 5, 10, '*')).toEqual({ value: 'Hola *mundo*', selectionStart: 6, selectionEnd: 11 });
  });

  it('leaves the cursor between the marks when nothing is selected', () => {
    expect(wrapSelection('Hola ', 5, 5, '_')).toEqual({ value: 'Hola __', selectionStart: 6, selectionEnd: 6 });
  });

  it('clamps out-of-range selections', () => {
    expect(wrapSelection('abc', 10, 20, '~').value).toBe('abc~~');
  });
});

describe('insertAtCursor', () => {
  it('replaces the selection and places the cursor after the inserted text', () => {
    expect(insertAtCursor('Hola , ok', 5, 5, '{cliente}')).toEqual({ value: 'Hola {cliente}, ok', cursor: 14 });
  });
});

describe('placeholderGroupsFor', () => {
  it('groups the data by topic in a fixed order and keeps only what the message allows', () => {
    const groups = placeholderGroupsFor('dia_pago');
    expect(groups.map((group) => group.id)).toEqual(['cliente', 'servicio', 'cobro']);
    expect(groups[0]?.items.map((item) => item.label)).toEqual(['Saludo', 'Primer nombre', 'Nombre completo']);
  });

  it('adds access and change groups for account messages', () => {
    const ids = placeholderGroupsFor('actualizacion_credenciales').map((group) => group.id);
    expect(ids).toEqual(['cliente', 'servicio', 'cobro', 'acceso', 'cambios']);
  });
});
