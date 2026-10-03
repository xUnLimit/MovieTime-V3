import { describe, expect, it, vi } from 'vitest';

import { createContactStore, registerInboundContacts, type ContactStore } from './contact-store';

describe('createContactStore', () => {
  it('llama al RPC y mapea la fila', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ wa_id: '50760000000', tercero_id: 't1', estado: 'cliente' }], error: null });
    const store = createContactStore({ rpc } as never);
    await expect(store.upsert('50760000000', '  Ana ')).resolves.toEqual({ waId: '50760000000', terceroId: 't1', estado: 'cliente' });
    expect(rpc).toHaveBeenCalledWith('upsert_whatsapp_contact', { p_wa_id: '50760000000', p_nombre_perfil: 'Ana' });
  });

  it('falla sin filtrar detalles cuando el RPC falla', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'secret' } });
    await expect(createContactStore({ rpc } as never).upsert('1', null)).rejects.toThrow('upsert failed: 42501');
  });
});

describe('registerInboundContacts', () => {
  it('registra una vez por remitente y nunca lanza', async () => {
    const upsert = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue({});
    const store = { upsert } as unknown as ContactStore;
    await expect(registerInboundContacts([
      { fromWaId: 'a', contactName: null }, { fromWaId: 'a', contactName: 'Ana' }, { fromWaId: 'b', contactName: null },
    ], 'req', () => store)).resolves.toBeUndefined();
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith('a', 'Ana');
  });

  it('tolera que el store no se pueda crear', async () => {
    await expect(registerInboundContacts([{ fromWaId: 'a', contactName: null }], 'req', () => { throw new Error('env'); }))
      .resolves.toBeUndefined();
  });
});
