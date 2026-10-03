import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/platform/supabase/database.types';
import { createRenewalSelectionRepository } from '@/platform/supabase/renewal-selection-repository';
import { createRenewalSelectionOrderRpc } from '@/platform/supabase/renewal-selection-rpc-adapter';
import type { RenewalItem } from '@/modules/renewal-selection/selection';
import type { RenewalSelectionDeps } from './renewal-selection-use-cases';

// Supply a read client and the existing decline path at the composition root.
// Order writes require an authenticated active operator, just like crear_pedido.
export function createRenewalSelectionDeps(client: SupabaseClient<Database>,
  injected: Pick<RenewalSelectionDeps, 'replies' | 'exchangeRate' | 'notifyAdmins'>): RenewalSelectionDeps {
  const repository = createRenewalSelectionRepository(client);
  return { ...injected, settings: repository.settings, ownsCustomer: repository.ownsCustomer,
    readOrder: repository.readOrder, createOrder: createRenewalSelectionOrderRpc, now: () => new Date(),
    async loadItems(notice, ids) {
      return (await repository.snapshots(ids)).flatMap(({ venta, period, service }): RenewalItem[] => {
        if (!period || !service || !venta.cliente_id) return [];
        const reason: RenewalItem['reason'] = venta.archivado_at || service.archivado_at ? 'archived'
          : venta.cortada_at || service.cortado_at ? 'cut'
          : service.en_reposo ? 'paused' : venta.respuesta_cliente === 'no_continuar' ? 'declined'
          : !notice.fecha_vencimiento || period.fecha_fin !== notice.fecha_vencimiento ? 'renewed'
          : venta.estado !== 'activo' || !service.activo ? 'unavailable' : null;
        return [{ ventaId: venta.id, clienteId: venta.cliente_id, periodId: period.id,
          servicio: service.nombre, perfil: venta.perfil_nombre ?? '', vencimiento: period.fecha_fin,
          ciclo: period.ciclo_pago, precio: period.precio_original, moneda: period.moneda_original, reason }];
      });
    },
  };
}
