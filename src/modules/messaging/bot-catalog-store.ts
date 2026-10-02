import { createCatalogRepository } from '@/platform/supabase/catalog-repository';
import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { z } from '@/platform/validation/zod';

const interestArgs = z.object({
  p_contact_id: z.string().regex(/^[0-9]{7,15}$/), p_categoria_id: z.string().uuid(),
  p_plan_id: z.string().uuid().nullable().optional(), p_origen: z.enum(['catalogo_agotado', 'manual']).optional(),
}).strict();

/** Service-role composition for the inbound bot; no payment/reservation capability is exposed. */
export function createBotCatalogStore() {
  const client = createServiceRoleClient();
  const repository = createCatalogRepository(async (name, args) => {
    // The repository accepts PostgreSQL's nullable argument contract. Narrow the two
    // exposed operations into generated client signatures without type assertions.
    if (name === 'catalogo_disponible') return await client.rpc('catalogo_disponible', {});
    if (name === 'registrar_interes') return await client.rpc('registrar_interes', interestArgs.parse(args));
    throw new Error('Catalog operation unavailable to the bot');
  });
  return { list: repository.list, registerInterest: repository.registerInterest };
}
