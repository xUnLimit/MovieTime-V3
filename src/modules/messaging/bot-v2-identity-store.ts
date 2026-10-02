import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { assertUuid } from '@/platform/utils/safety';
import { z } from '@/platform/validation/zod';
import type { BotService } from './bot-store';

type Result = { data: unknown; error: { code?: string } | null };
type IdentityClient = {
  people(waId: string): PromiseLike<Result>;
  sale(ventaId: string, clienteId: string): PromiseLike<Result>;
  service(servicioId: string): PromiseLike<Result>;
  categories(clienteId: string): PromiseLike<Result>;
  orders(waId: string): PromiseLike<Result>;
  taps(waId: string, since: string): PromiseLike<Result>;
};
function serviceClient(): IdentityClient {
  const client = createServiceRoleClient();
  return {
    people: waId => client.from('terceros').select('id').eq('wa_id', waId).eq('active', true).limit(2),
    sale: (id, customer) => client.from('v_ventas_full').select('servicio_id,servicio_correo,perfil_nombre,acceso_por_codigo')
      .eq('id', id).eq('cliente_id', customer).eq('estado', 'activo').maybeSingle(),
    service: id => client.from('servicios').select('activo,acceso_por_codigo,categorias!servicios_categoria_id_fkey(code_provider)')
      .eq('id', id).maybeSingle(),
    categories: customer => client.from('v_ventas_full').select('categoria_id').eq('cliente_id', customer).eq('estado', 'activo'),
    orders: waId => client.from('pedidos').select('id').eq('contact_id', waId)
      .in('estado', ['borrador', 'esperando_pago', 'pago_en_revision']).gt('expira_at', new Date().toISOString()).limit(1),
    // Count all inbound messages so spelling/case/spacing of free-text aliases cannot bypass the limit.
    taps: (waId, since) => client.from('whatsapp_inbound_messages').select('id', { count: 'exact', head: true })
      .eq('from_wa_id', waId).gte('sent_at', since).then(({ count, error }) => ({ data: count, error })),
  };
}
const peopleSchema = z.array(z.object({ id: z.string().uuid() })).max(2);
const saleSchema = z.object({ servicio_id: z.string().uuid(), servicio_correo: z.string().email(),
  perfil_nombre: z.string().nullable(), acceso_por_codigo: z.boolean() });
const serviceSchema = z.object({ activo: z.boolean(), acceso_por_codigo: z.boolean(),
  categorias: z.object({ code_provider: z.string().nullable() }).nullable() });
async function read(result: PromiseLike<Result>): Promise<unknown> {
  const row = await result;
  if (row.error) throw new Error('Bot identity lookup failed');
  return row.data;
}
export function createBotV2IdentityStore(client: IdentityClient = serviceClient()) {
  async function customer(waId: string) {
    z.string().regex(/^[0-9]{7,15}$/).parse(waId);
    const people = peopleSchema.parse(await read(client.people(waId)));
    return people.length === 1 ? people[0].id : null;
  }
  return {
    async requestsSince(waId: string, since: string): Promise<number> {
      z.string().regex(/^[0-9]{7,15}$/).parse(waId);
      z.iso.datetime({ offset: true }).parse(since);
      return z.number().int().nonnegative().parse(await read(client.taps(waId, since)));
    },
    async codeSale(waId: string, ventaId: string): Promise<BotService | null> {
      assertUuid(ventaId, 'Venta');
      const person = await customer(waId);
      if (!person) return null;
      const sale = saleSchema.safeParse(await read(client.sale(ventaId, person)));
      if (!sale.success || !sale.data.acceso_por_codigo) return null;
      const service = serviceSchema.safeParse(await read(client.service(sale.data.servicio_id)));
      // Only the Netflix delivery pipeline is currently bound. Other providers fail closed.
      if (!service.success || !service.data.activo || !service.data.acceso_por_codigo || service.data.categorias?.code_provider !== 'netflix') return null;
      return { serviceId: sale.data.servicio_id, email: sale.data.servicio_correo.trim().toLowerCase(),
        profiles: sale.data.perfil_nombre?.trim() ? [sale.data.perfil_nombre.trim()] : [], providerKey: 'netflix' };
    },
    async context(waId: string) {
      const person = await customer(waId);
      if (!person) throw new Error('Bot identity unavailable');
      const categories = z.array(z.object({ categoria_id: z.string().uuid().nullable() })).parse(await read(client.categories(person)));
      const orders = z.array(z.object({ id: z.string().uuid() })).parse(await read(client.orders(waId)));
      return { activeCategories: [...new Set(categories.flatMap(row => row.categoria_id ? [row.categoria_id] : []))], pendingOrder: orders.length > 0 };
    },
  };
}
