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
});

