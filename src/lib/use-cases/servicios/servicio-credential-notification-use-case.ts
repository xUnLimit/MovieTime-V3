import { queryVentas } from '@/lib/supabase/ventas-repository';
import type { Servicio, Tercero, VentaDoc } from '@/types';
import type { CredentialChangeFlags } from '@/lib/utils/credentialNotification';

export type ServicioForCredentialNotification = Pick<
  Servicio,
  'id' | 'nombre' | 'categoriaNombre' | 'correo' | 'contrasena'
>;

export type CredentialNotificationContext = {
  servicio: ServicioForCredentialNotification;
  changes: CredentialChangeFlags;
  terceros: Tercero[];
  template?: string;
};

export async function getVentasActivasParaCredenciales(servicioId: string): Promise<VentaDoc[]> {
  return queryVentas<VentaDoc>([
    { field: 'servicioId', operator: '==', value: servicioId },
    { field: 'estado', operator: '!=', value: 'inactivo' },
  ]);
}
