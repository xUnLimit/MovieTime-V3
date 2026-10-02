import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { assertUuid } from '@/platform/utils/safety';
import { DomainError } from '@/platform/errors/domain-errors';

type Client = SupabaseClient<Database>;
function check(error: unknown) {
  if (error) throw new DomainError('No se pudo consultar la renovación.', 'RENEWAL_READ_FAILED');
}

export function createRenewalSelectionRepository(client: Client) {
  return {
    async settings() {
      const { data, error } = await client.from('renovacion_ajustes').select('*').eq('id', 'global').single();
      check(error);
      if (!data) throw new DomainError('La renovación no está configurada.', 'RENEWAL_DISABLED');
      return data;
    },
    async ownsCustomer(waId: string, clienteId: string) {
      assertUuid(clienteId, 'Cliente');
      const { data, error } = await client.from('terceros').select('id').eq('wa_id', waId).eq('active', true).limit(2);
      check(error);
      return data?.length === 1 && data[0].id === clienteId;
    },
    async snapshots(ids: string[]) {
      ids.forEach(id => assertUuid(id, 'Venta'));
      const [sales, periods] = await Promise.all([
        client.from('ventas').select('id,cliente_id,servicio_id,perfil_nombre,estado,cortada_at,archivado_at,respuesta_cliente').in('id', ids),
        client.from('venta_periodos').select('id,venta_id,numero_periodo,fecha_fin,ciclo_pago,precio_original,moneda_original').in('venta_id', ids).order('numero_periodo', { ascending: false }),
      ]);
      check(sales.error); check(periods.error);
      const serviceIds = [...new Set((sales.data ?? []).map(v => v.servicio_id))];
      const services = await client.from('servicios').select('id,nombre,activo,en_reposo,cortado_at,archivado_at').in('id', serviceIds);
      check(services.error);
      return (sales.data ?? []).map(venta => ({ venta,
        period: periods.data?.find(p => p.venta_id === venta.id),
        service: services.data?.find(s => s.id === venta.servicio_id),
      }));
    },
    async readOrder(id: string) {
      assertUuid(id, 'Pedido');
      const { data, error } = await client.from('pedidos').select('id,total,moneda').eq('id', id).maybeSingle();
      check(error);
      return data;
    },
  };
}
