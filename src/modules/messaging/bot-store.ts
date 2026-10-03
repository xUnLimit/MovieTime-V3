import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { normalizePanamaWaId } from './message-data';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;
// profiles lists the Netflix profile names noted on the customer's sales of this account.
export type BotService = { serviceId: string; email: string; profiles: string[]; providerKey?: string };
export type BotStore = {
  // services is empty for a number that is not exactly one active customer.
  customerServices(waId: string): Promise<{ known: boolean; clienteId: string | null; services: BotService[] }>;
  lastActivityAt(waId: string, exceptWaMessageId: string): Promise<string | null>;
  operatorRepliedSince(waId: string, since: string): Promise<boolean>;
  menuTapsSince(waId: string, since: string): Promise<number>;
};

function check(error: { code?: string } | null, action: string): void {
  if (error) throw new Error(`Bot store ${action} failed: ${error.code ?? 'unknown'}`);
}

export function createBotStore(client: ServiceClient = createServiceRoleClient()): BotStore {
  return {
    async customerServices(waId) {
      // terceros.wa_id es la columna generada con la misma regla que normalizePanamaWaId; limit(2) basta para
      // distinguir "exactamente uno" de un numero compartido sin traer a todos los clientes.
      if (normalizePanamaWaId(waId) !== waId) return { known: false, clienteId: null, services: [] };
      const { data: people, error } = await client.from('terceros').select('id')
        .eq('wa_id', waId).eq('active', true).limit(2);
      check(error, 'customer lookup');
      const matches = people ?? [];
      if (matches.length !== 1) return { known: false, clienteId: null, services: [] };
      const { data: ventas, error: ventasError } = await client.from('v_ventas_full')
        .select('servicio_id,servicio_correo,perfil_nombre,categoria_nombre,servicio_nombre')
        .eq('cliente_id', matches[0].id).eq('estado', 'activo');
      check(ventasError, 'sales lookup');
      const sales = (ventas ?? []).filter((venta) => venta.servicio_id && venta.servicio_correo);
      const ids = [...new Set(sales.flatMap((venta) => venta.servicio_id ? [venta.servicio_id] : []))];
      if (ids.length === 0) return { known: true, clienteId: matches[0].id, services: [] };
      const { data: states, error: statesError } = await client.from('servicios').select('id,activo,categorias!servicios_categoria_id_fkey(code_provider)').in('id', ids);
      check(statesError, 'service state lookup');
      const active = new Map((states ?? []).filter((row) => row.activo && row.categorias?.code_provider)
        .map((row) => [row.id, row.categorias?.code_provider]));
      const byEmail = new Map<string, BotService>();
      for (const venta of sales) {
        const email = venta.servicio_correo?.trim().toLowerCase();
        if (!venta.servicio_id || !email || !active.has(venta.servicio_id)) continue;
        const providerKey = active.get(venta.servicio_id);
        if (!providerKey) continue;
        const accountKey = `${providerKey}:${email}`;
        const service: BotService = byEmail.get(accountKey) ?? { serviceId: venta.servicio_id, email, profiles: [], providerKey };
        const profile = venta.perfil_nombre?.trim();
        if (profile && !service.profiles.includes(profile)) service.profiles.push(profile);
        byEmail.set(accountKey, service);
      }
      return { known: true, clienteId: matches[0].id, services: [...byEmail.values()] };
    },
    async lastActivityAt(waId, exceptWaMessageId) {
      const [inbound, outbound] = await Promise.all([
        client.from('whatsapp_inbound_messages').select('sent_at').eq('from_wa_id', waId)
          .neq('wa_message_id', exceptWaMessageId).order('sent_at', { ascending: false }).limit(1).maybeSingle(),
        client.from('whatsapp_outbound_messages').select('created_at').eq('to_wa_id', waId)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      check(inbound.error, 'last inbound lookup');
      check(outbound.error, 'last outbound lookup');
      const times = [inbound.data?.sent_at, outbound.data?.created_at].flatMap((value) => value ? [value] : []);
      return times.length === 0 ? null : times.reduce((latest, value) => Date.parse(value) > Date.parse(latest) ? value : latest);
    },
    async operatorRepliedSince(waId, since) {
      const { data, error } = await client.from('whatsapp_outbound_messages').select('id')
        .eq('to_wa_id', waId).not('sent_by', 'is', null).gte('created_at', since).limit(1);
      check(error, 'operator reply lookup');
      return (data?.length ?? 0) > 0;
    },
    async menuTapsSince(waId, since) {
      const { count, error } = await client.from('whatsapp_inbound_messages')
        .select('id', { count: 'exact', head: true }).eq('from_wa_id', waId)
        .like('payload->>id', 'BOT:%').gte('sent_at', since);
      check(error, 'menu tap count');
      return count ?? 0;
    },
  };
}
