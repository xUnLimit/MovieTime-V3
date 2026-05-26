import type { Tercero } from '@/types';

export interface TerceroDisplay {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string;
  metodoPagoNombre: string;
  tipo: 'Cliente' | 'Revendedor';
  serviciosActivos: number;
  montoSinConsumir: number;
  original: Tercero;
}

export interface MetodoPagoFilterOption {
  value: string;
  label: string;
}
