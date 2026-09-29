import { describe, expect, it } from 'vitest';

import { insertAtCursor, wrapSelection } from './editor-constants';

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
