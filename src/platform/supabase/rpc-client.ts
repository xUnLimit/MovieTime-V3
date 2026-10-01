import { ValidationError } from '@/platform/errors/domain-errors';
import { z } from '@/platform/validation/zod';
import type { Database } from './database.types';
import { supabase } from './client';
import type { RpcArgs } from './rpc-args';

export type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

const voidResultSchema = z.union([z.null(), z.undefined()]);

export async function callRpc<Name extends keyof Database['public']['Functions']>(
  name: Name,
  args: RpcArgs<Name>
): Promise<RpcResult> {
  // PostgreSQL acepta NULL en cada argumento; los tipos generados no lo expresan.
  // Nombre, claves y tipos permanecen ligados a Database y fallan al cambiar el esquema.
  return await supabase.rpc(name, args as Database['public']['Functions'][Name]['Args']);
}

export function assertRpcVoidResult(data: unknown, operation: string): void {
  if (!voidResultSchema.safeParse(data).success) {
    throw new ValidationError(`Respuesta invalida de ${operation}`);
  }
}
