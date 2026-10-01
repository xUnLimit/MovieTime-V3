import type { ExecutivePushBlock, ExecutivePushSummaryBlock } from '@/types';
import { getExecutivePushBlockMeta } from '@/modules/pwa';

interface ExecutivePushBlockSettings {
  selectedBlocks: ExecutivePushBlock[];
  blockOrder: ExecutivePushBlock[];
}

interface VentaNotificationRow {
  cliente_id: string | null;
}

interface ServicioNotificationRow {
  costo_servicio_snapshot: number | string | null;
  moneda_snapshot: string | null;
}

export function buildExecutivePushSummaryBlocks({
  reposoCount,
  servicioNotifications,
  settings,
  ventaNotifications,
}: {
  reposoCount: number;
  servicioNotifications: ServicioNotificationRow[];
  settings: ExecutivePushBlockSettings;
  ventaNotifications: VentaNotificationRow[];
}): ExecutivePushSummaryBlock[] {
  const orderedBlocks = settings.blockOrder.length > 0 ? settings.blockOrder : settings.selectedBlocks;
  const selectedSet = new Set(settings.selectedBlocks);
  const distinctClientes = new Set(
    ventaNotifications
      .map((item) => item.cliente_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  );
  const montoPorMoneda = servicioNotifications.reduce<Record<string, number>>((acc, item) => {
    const costo = Number(item.costo_servicio_snapshot ?? 0);
    if (!Number.isFinite(costo) || costo === 0) return acc;
    const moneda = (typeof item.moneda_snapshot === 'string' && item.moneda_snapshot.length > 0)
      ? item.moneda_snapshot.toUpperCase()
      : 'USD';
    acc[moneda] = (acc[moneda] ?? 0) + costo;
    return acc;
  }, {});

  const builders: Record<ExecutivePushBlock, () => ExecutivePushSummaryBlock> = {
    clientes_por_notificar: () => ({
      key: 'clientes_por_notificar',
      label: getExecutivePushBlockMeta('clientes_por_notificar')?.label ?? 'Clientes a notificar',
      count: distinctClientes.size,
      destination: '/notificaciones',
      tab: 'ventas',
    }),
    servicios_por_pagar: () => ({
      key: 'servicios_por_pagar',
      label: getExecutivePushBlockMeta('servicios_por_pagar')?.label ?? 'Servicios por pagar',
      count: servicioNotifications.length,
      destination: '/notificaciones',
      tab: 'servicios',
    }),
    reposo_terminado: () => ({
      key: 'reposo_terminado',
      label: getExecutivePushBlockMeta('reposo_terminado')?.label ?? 'Servicios en reposo finalizados',
      count: reposoCount,
      destination: '/notificaciones',
      tab: 'reposo',
    }),
    monto_a_fondear: () => ({
      key: 'monto_a_fondear',
      label: getExecutivePushBlockMeta('monto_a_fondear')?.label ?? 'Monto a pagar',
      amounts: montoPorMoneda,
      destination: '/dashboard',
    }),
  };

  return orderedBlocks
    .filter((block): block is ExecutivePushBlock => selectedSet.has(block) && block in builders)
    .map((block) => builders[block]());
}
