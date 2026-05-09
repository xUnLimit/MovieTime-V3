import type { ExecutivePushBlock } from '@/types';

export const EXECUTIVE_PUSH_BLOCKS: { key: ExecutivePushBlock; label: string; destination: string; tab?: string }[] = [
  {
    key: 'clientes_por_notificar',
    label: 'Clientes a notificar',
    destination: '/notificaciones',
    tab: 'ventas',
  },
  {
    key: 'servicios_por_pagar',
    label: 'Servicios por pagar',
    destination: '/notificaciones',
    tab: 'servicios',
  },
  {
    key: 'reposo_terminado',
    label: 'Reposo terminado',
    destination: '/notificaciones',
    tab: 'reposo',
  },
  {
    key: 'monto_a_fondear',
    label: 'Monto a fondear',
    destination: '/dashboard',
  },
];
