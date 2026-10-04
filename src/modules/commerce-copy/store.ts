import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { isCopyKey } from './catalog';
import { copyProblem, type CopyOverrides } from './render';

type Client = ReturnType<typeof createServiceRoleClient>;

/** Textos editados. Ignora filas con claves desconocidas o que ya no cumplen las reglas del mensaje. */
export function createCommerceCopyStore(client: Client = createServiceRoleClient()) {
  return {
    async overrides(): Promise<CopyOverrides> {
      const { data, error } = await client.from('mt_commerce_copy').select('key,text').limit(200);
      if (error) throw new Error('No se pudieron leer los textos de compras.', { cause: error });
      return Object.fromEntries((data ?? []).filter(row => isCopyKey(row.key) && copyProblem(row.key, row.text) === null)
        .map(row => [row.key, row.text]));
    },
    async updatedAt(): Promise<Record<string, string>> {
      const { data, error } = await client.from('mt_commerce_copy').select('key,updated_at').limit(200);
      if (error) throw new Error('No se pudieron leer los textos de compras.', { cause: error });
      return Object.fromEntries((data ?? []).map(row => [row.key, row.updated_at]));
    },
  };
}
