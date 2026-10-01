import { ValidationError } from '@/platform/errors/domain-errors';
import type { Database, Json } from '@/platform/supabase/database.types';
import { z } from '@/platform/validation/zod';

import { supabase } from './client';
import { assertRpcVoidResult } from './rpc-client';

type DeleteCategoriaArgs = Database['public']['Functions']['delete_categoria']['Args'];

const categoriasFullSchema = z.array(z.object({
  id: z.string().min(1),
  nombre: z.string(),
}).passthrough());
const categoriasCountsSchema = z.object({
  totalCategorias: z.number(),
  categoriasClientes: z.number().optional(),
  categoriasRevendedores: z.number().optional(),
}).passthrough();

export async function getCategoriasFullRpc(): Promise<Json | null> {
  const { data, error } = await supabase.rpc('get_categorias_full');
  if (error) throw new Error(error.message);
  if (!categoriasFullSchema.safeParse(data).success) {
    throw new ValidationError('Respuesta invalida de get_categorias_full');
  }
  return data;
}

export async function getCategoriasCountsRpc(): Promise<Json | null> {
  const { data, error } = await supabase.rpc('get_categorias_counts');
  if (error) throw new Error(error.message);
  if (!categoriasCountsSchema.safeParse(data).success) {
    throw new ValidationError('Respuesta invalida de get_categorias_counts');
  }
  return data;
}

export async function deleteCategoriaRpc(categoriaId: string): Promise<void> {
  const args: DeleteCategoriaArgs = { p_categoria_id: categoriaId };
  const { data, error } = await supabase.rpc('delete_categoria', args);
  if (error) throw new Error(error.message);
  assertRpcVoidResult(data, 'delete_categoria');
}
