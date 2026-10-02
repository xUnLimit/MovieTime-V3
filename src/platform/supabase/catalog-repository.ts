import { z } from '@/platform/validation/zod';
import { DomainError, ValidationError } from '@/platform/errors/domain-errors';
import { assertUuid } from '@/platform/utils/safety';
import type { Database } from './database.types';
import { catalogHoldSchema, catalogInterestSchema, catalogItemSchema } from './catalog-contracts';
import type { RpcArgs } from './rpc-args';
import type { RpcResult } from './rpc-client';

type CatalogRpcName = 'catalogo_disponible' | 'reservar_perfil' | 'liberar_reserva'
  | 'expirar_reservas' | 'registrar_interes' | 'siguiente_interesado';
type Rpc = <Name extends CatalogRpcName>(name: Name, args: RpcArgs<Name>) => Promise<RpcResult>;
const ownerSchema = z.string().trim().min(1).max(200);
const contactSchema = z.string().regex(/^[0-9]{1,32}$/);
const originSchema = z.enum(['catalogo_agotado', 'manual']);

/** Inject an authenticated admin or server service-role client at composition root.
 * No global browser client, retries or hidden credential access. Mutations are
 * idempotent except FIFO claims: callers must never blindly retry those.
 */
export function createCatalogRepository(rpc: Rpc, timeoutMs = 10_000) {
  const timeout = z.number().int().min(1).max(60_000).parse(timeoutMs);
  async function execute<Name extends CatalogRpcName>(name: Name, args: RpcArgs<Name>): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        rpc(name, args),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new DomainError('Tiempo agotado.', 'CATALOG_UNAVAILABLE')), timeout);
        }),
      ]);
      if (result.error) throw new DomainError('No se pudo operar el catalogo.', 'CATALOG_UNAVAILABLE');
      return result.data;
    } catch {
      throw new DomainError('No se pudo operar el catalogo.', 'CATALOG_UNAVAILABLE');
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  function parse<T>(schema: z.ZodType<T>, value: unknown): T {
    const result = schema.safeParse(value);
    if (!result.success) throw new ValidationError('Respuesta invalida del catalogo.');
    return result.data;
  }

  return {
    async list() {
      return parse(z.array(catalogItemSchema), await execute('catalogo_disponible', {}));
    },
    async reserve(servicioId: string, ownerRef: string, planId: string | null = null) {
      const args: Database['public']['Functions']['reservar_perfil']['Args'] = {
        p_servicio_id: assertUuid(servicioId, 'Servicio'), p_owner_ref: ownerSchema.parse(ownerRef),
        p_plan_id: planId === null ? null : assertUuid(planId, 'Plan'),
      };
      const rows = parse(z.array(catalogHoldSchema).max(1), await execute('reservar_perfil', args));
      return rows[0] ?? null;
    },
    async release(reservaId: string, ownerRef: string) {
      return parse(z.boolean(), await execute('liberar_reserva', {
        p_reserva_id: assertUuid(reservaId, 'Reserva'), p_owner_ref: ownerSchema.parse(ownerRef),
      }));
    },
    async expire() {
      return parse(z.number().int().nonnegative(), await execute('expirar_reservas', {}));
    },
    async registerInterest(contactId: string, categoriaId: string, planId: string | null = null,
      origen: 'catalogo_agotado' | 'manual' = 'catalogo_agotado') {
      return parse(z.string().uuid(), await execute('registrar_interes', {
        p_contact_id: contactSchema.parse(contactId), p_categoria_id: assertUuid(categoriaId, 'Categoria'),
        p_plan_id: planId === null ? null : assertUuid(planId, 'Plan'), p_origen: originSchema.parse(origen),
      }));
    },
    async nextInterest(categoriaId: string, planId: string | null = null) {
      const rows = parse(z.array(catalogInterestSchema).max(1), await execute('siguiente_interesado', {
        p_categoria_id: assertUuid(categoriaId, 'Categoria'),
        p_plan_id: planId === null ? null : assertUuid(planId, 'Plan'),
      }));
      return rows[0] ?? null;
    },
  };
}
