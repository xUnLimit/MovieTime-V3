import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearAllChatDrafts, readChatDraft, writeChatDraft } from './chat-drafts';

// Storage en memoria real (con length/key), a diferencia del mock global del
// proyecto que no implementa esas dos propiedades.
function fakeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chat drafts', () => {
  it('writes, reads and clears a single draft', () => {
    vi.stubGlobal('localStorage', fakeStorage());

    expect(readChatDraft('507')).toBe('');
    writeChatDraft('507', 'Hola');
    expect(readChatDraft('507')).toBe('Hola');

    writeChatDraft('507', '');
    expect(readChatDraft('507')).toBe('');
  });

  it('keeps drafts of different chats apart', () => {
    vi.stubGlobal('localStorage', fakeStorage());

    writeChatDraft('507', 'Uno');
    writeChatDraft('508', 'Dos');

    expect(readChatDraft('507')).toBe('Uno');
    expect(readChatDraft('508')).toBe('Dos');
  });

  it('removes only chat-draft keys, leaving unrelated storage untouched', () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);

    writeChatDraft('507', 'Clave: clave-demo');
    writeChatDraft('508', 'Hola');
    storage.setItem('other-app-setting', 'value');

    clearAllChatDrafts();

    expect(readChatDraft('507')).toBe('');
    expect(readChatDraft('508')).toBe('');
    expect(storage.getItem('other-app-setting')).toBe('value');
  });

  it('does not throw when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      get length(): number { throw new Error('blocked'); },
      key: () => { throw new Error('blocked'); },
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
      clear: () => { throw new Error('blocked'); },
    });

    expect(() => writeChatDraft('507', 'x')).not.toThrow();
    expect(readChatDraft('507')).toBe('');
    expect(() => clearAllChatDrafts()).not.toThrow();
  });
});
