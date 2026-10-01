import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('./client', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import {
  deleteCategoriaRpc,
  getCategoriasCountsRpc,
  getCategoriasFullRpc,
} from './categorias-rpc-adapter';

describe('getCategoriasFullRpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the typed RPC and returns JSON data', async () => {
    const data = [{ id: 'categoria-1', nombre: 'Netflix' }];
    rpcMock.mockResolvedValue({ data, error: null });

    await expect(getCategoriasFullRpc()).resolves.toBe(data);

    expect(rpcMock).toHaveBeenCalledWith('get_categorias_full');
  });

  it('throws the Supabase error message', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

    await expect(getCategoriasFullRpc()).rejects.toThrow('RPC failed');
  });

  it.each([null, { id: 'categoria-1' }, [{ id: '', nombre: 'Netflix' }]])(
    'rechaza una lista de categorias invalida', async (data) => {
      rpcMock.mockResolvedValue({ data, error: null });
      await expect(getCategoriasFullRpc()).rejects.toThrow('Respuesta invalida de get_categorias_full');
    }
  );
});

describe('getCategoriasCountsRpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the typed RPC and returns JSON data', async () => {
    const data = { totalCategorias: 1 };
    rpcMock.mockResolvedValue({ data, error: null });

    await expect(getCategoriasCountsRpc()).resolves.toBe(data);

    expect(rpcMock).toHaveBeenCalledWith('get_categorias_counts');
  });

  it('throws the Supabase error message', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

    await expect(getCategoriasCountsRpc()).rejects.toThrow('RPC failed');
  });

  it.each([null, [], { totalCategorias: '1' }])(
    'rechaza conteos invalidos', async (data) => {
      rpcMock.mockResolvedValue({ data, error: null });
      await expect(getCategoriasCountsRpc()).rejects.toThrow('Respuesta invalida de get_categorias_counts');
    }
  );
});

describe('deleteCategoriaRpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the typed RPC with the expected payload', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await expect(deleteCategoriaRpc('categoria-1')).resolves.toBeUndefined();
    expect(rpcMock).toHaveBeenCalledWith('delete_categoria', {
      p_categoria_id: 'categoria-1',
    });
  });

  it('throws the Supabase error message', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

    await expect(deleteCategoriaRpc('categoria-1')).rejects.toThrow('RPC failed');
  });

  it('rechaza un retorno inesperado al eliminar', async () => {
    rpcMock.mockResolvedValue({ data: { id: 'categoria-1' }, error: null });
    await expect(deleteCategoriaRpc('categoria-1')).rejects.toThrow('Respuesta invalida de delete_categoria');
  });
});

