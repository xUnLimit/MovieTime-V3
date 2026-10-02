import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { normalizePanamaWaId } from './message-data';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;
export type BotService = { serviceId: string; email: string; profile: string };
export type BotStore = {
  // services is empty for a number that is not exactly one active customer.
  customerServices(waId: string): Promise<{ known: boolean; services: BotService[] }>;
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
      const { data: people, error } = await client.from('terceros').select('id,telefono').eq('active', true);
      check(error, 'customer lookup');
      const matches = (people ?? []).filter((row) => normalizePanamaWaId(row.telefono ?? '') === waId);
      if (matches.length !== 1) return { known: false, services: [] };
      const { data: ventas, error: ventasError } = await client.from('v_ventas_full')
        .select('servicio_id,servicio_correo,perfil_nombre,categoria_nombre,servicio_nombre')
        .eq('cliente_id', matches[0].id).eq('estado', 'activo');
      check(ventasError, 'sales lookup');
      const netflix = (ventas ?? []).filter((venta) => venta.servicio_id && venta.servicio_correo
        && /netflix/i.test(`${venta.categoria_nombre ?? ''} ${venta.servicio_nombre ?? ''}`));
      const ids = [...new Set(netflix.flatMap((venta) => venta.servicio_id ? [venta.servicio_id] : []))];
      if (ids.length === 0) return { known: true, services: [] };
      const { data: states, error: statesError } = await client.from('servicios').select('id,activo').in('id', ids);
      check(statesError, 'service state lookup');
      const active = new Set((states ?? []).filter((row) => row.activo).map((row) => row.id));
      const byEmail = new Map<string, BotService>();
      for (const venta of netflix) {
        const email = venta.servicio_correo?.trim().toLowerCase();
        if (!venta.servicio_id || !email || !active.has(venta.servicio_id) || byEmail.has(email)) continue;
        byEmail.set(email, { serviceId: venta.servicio_id, email, profile: venta.perfil_nombre ?? '' });
      }
      return { known: true, services: [...byEmail.values()] };
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
