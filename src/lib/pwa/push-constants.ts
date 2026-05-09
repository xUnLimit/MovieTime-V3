import type { ExecutivePushBlock } from '@/types';

export const EXECUTIVE_PUSH_BLOCKS: { key: ExecutivePushBlock; label: string; destination: string; tab?: string }[] = [
  {
    key: 'clientes_por_notificar',
    label: 'Clientes a notificar',
    destination: '/notificaciones',
    tab: 'ventas',
  },
  {
    key: 'ventas_por_vencer',
    label: 'Ventas por vencer',
    destination: '/notificaciones',
    tab: 'ventas',
  },
  {
    key: 'servicios_por_pagar_hoy',
    label: 'Servicios por pagar hoy',
    destination: '/notificaciones',
    tab: 'servicios',
  },
  {
    key: 'monto_a_pagar_hoy',
    label: 'Monto a pagar hoy',
    destination: '/notificaciones',
    tab: 'servicios',
  },
  {
    key: 'monto_a_fondear',
    label: 'Monto a fondear',
    destination: '/dashboard',
  },
];
