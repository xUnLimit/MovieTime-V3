import { createServiceRoleClient } from '@/platform/server/supabase-server';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

/** Una venta activa y vigente del cliente a la que se le puede reenviar su acceso. `codeOnly`: el servicio entra con código (no se envía la contraseña). */
type AccessSaleRow = { saleId: string; service: string; profile: string; codeOnly: boolean };
export type AccessDataStore = {
  // `clienteId` es null cuando el número no es exactamente un cliente activo; entonces no hay ventas.
  eligibleSales(waId: string): Promise<{ clienteId: string | null; sales: AccessSaleRow[] }>;
};

const MAX_SALES = 50;

function check(error: { code?: string } | null, action: string): void {
  if (error) throw new Error(`Access data store ${action} failed: ${error.code ?? 'unknown'}`);
}

/**
 * Las ventas de las que un número puede pedir sus datos: las de su propio cliente (el número debe pertenecer a un solo cliente activo),
 * activas, vigentes, de un servicio en uso (no en reposo, cortado ni archivado) y sin reembolso en su último periodo.
 */
export function createAccessDataStore(client: ServiceClient = createServiceRoleClient()): AccessDataStore {
  return {
    async eligibleSales(waId) {
      const { data: people, error } = await client.from('terceros').select('id').eq('active', true).eq('wa_id', waId).limit(2);
      check(error, 'customer lookup');
      if ((people ?? []).length !== 1) return { clienteId: null, sales: [] };
      const clienteId = people![0].id;
      const { data: ventas, error: ventasError } = await client.from('v_ventas_full')
        .select('id,servicio_id,servicio_nombre,categoria_nombre,perfil_nombre,ultimo_periodo_id')
        .eq('cliente_id', clienteId).eq('estado', 'activo')
        .gte('ultima_fecha_fin', new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' }))
        .limit(MAX_SALES);
      check(ventasError, 'sales lookup');
      const rows = (ventas ?? []).filter((venta) => venta.id && venta.servicio_id);
      if (rows.length === 0) return { clienteId, sales: [] };
      const serviceIds = [...new Set(rows.flatMap((venta) => venta.servicio_id ? [venta.servicio_id] : []))];
      const periodIds = [...new Set(rows.flatMap((venta) => venta.ultimo_periodo_id ? [venta.ultimo_periodo_id] : []))];
      const [states, access, refunds] = await Promise.all([
        client.from('servicios').select('id,activo,en_reposo,cortado_at,archivado_at').in('id', serviceIds),
        client.from('mt_service_access').select('service_id,mode').in('service_id', serviceIds),
        periodIds.length
          ? client.from('pagos_venta').select('venta_periodo_id').in('venta_periodo_id', periodIds).eq('estado', 'reembolsado')
          : Promise.resolve({ data: [], error: null }),
      ]);
      check(states.error, 'service state lookup');
      check(access.error, 'access policy lookup');
      check(refunds.error, 'refund lookup');
      const inUse = new Set((states.data ?? []).filter((row) => row.activo && !row.en_reposo && !row.cortado_at && !row.archivado_at).map((row) => row.id));
      const codeOnly = new Set((access.data ?? []).filter((row) => row.mode === 'code').map((row) => row.service_id));
      const refunded = new Set((refunds.data ?? []).map((row) => row.venta_periodo_id));
      const sales = rows.flatMap((venta): AccessSaleRow[] => {
        if (!venta.id || !venta.servicio_id || !inUse.has(venta.servicio_id)) return [];
        if (venta.ultimo_periodo_id && refunded.has(venta.ultimo_periodo_id)) return [];
        return [{
          saleId: venta.id, service: (venta.categoria_nombre || 'Servicio').trim(),
          profile: (venta.perfil_nombre ?? '').trim(), codeOnly: codeOnly.has(venta.servicio_id),
        }];
      });
      return { clienteId, sales };
    },
  };
}
