import { assertOnlineMutation } from '@/lib/pwa/mutation-guard';
import type { Json } from '@/lib/supabase/database.types';

import { supabase } from './client';

type RpcResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type CategoriasRpcClient = {
  rpc: (fn: 'get_categorias_full', args?: never) => Promise<RpcResult<Json>>;
};

type CategoriasCountsRpcClient = {
  rpc: (fn: 'get_categorias_counts', args?: never) => Promise<RpcResult<Json>>;
};

type DeleteCategoriaRpcClient = {
  rpc: (
    fn: 'delete_categoria',
    args: { p_categoria_id: string }
  ) => Promise<RpcResult<undefined>>;
};

const categoriasRpcClient = supabase as unknown as CategoriasRpcClient;
const categoriasCountsRpcClient = supabase as unknown as CategoriasCountsRpcClient;
const deleteCategoriaRpcClient = supabase as unknown as DeleteCategoriaRpcClient;

export async function getCategoriasFullRpc(): Promise<Json | null> {
  const { data, error } = await categoriasRpcClient.rpc('get_categorias_full');
  if (error) throw new Error(error.message);
  return data;
}

export async function getCategoriasCountsRpc(): Promise<Json | null> {
  const { data, error } = await categoriasCountsRpcClient.rpc('get_categorias_counts');
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCategoriaRpc(categoriaId: string): Promise<void> {
  assertOnlineMutation();
  const { error } = await deleteCategoriaRpcClient.rpc('delete_categoria', {
    p_categoria_id: categoriaId,
  });
  if (error) throw new Error(error.message);
}
