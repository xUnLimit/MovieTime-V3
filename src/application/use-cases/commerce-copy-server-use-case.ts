import { createCommerceCopyStore } from '@/modules/commerce-copy/store';
import type { CopyCommand } from '@/modules/commerce-copy/contracts';
import { createUserRequestClient } from '@/platform/server/supabase-server';
import { assertRpcStringId } from '@/platform/utils/safety';

export type CommerceCopyState = { overrides: Record<string, string>; updatedAt: Record<string, string> };

export async function readCommerceCopyUseCase(): Promise<CommerceCopyState> {
  const store = createCommerceCopyStore();
  const [overrides, updatedAt] = await Promise.all([store.overrides(), store.updatedAt()]);
  return { overrides: overrides as Record<string, string>, updatedAt };
}

/** Guarda o restaura (text null) un texto con la sesion del administrador: la base decide con su rol. */
export async function saveCommerceCopyUseCase(command: CopyCommand, authorization: string): Promise<string> {
  const { data, error } = await createUserRequestClient(authorization).rpc('mt_set_commerce_copy', { p_key: command.key, p_text: command.text });
  if (error) throw new Error('No se pudo guardar el texto. Revisa tu conexión y vuelve a intentar.', { cause: error });
  return assertRpcStringId(data, 'Guardar texto de compras');
}
