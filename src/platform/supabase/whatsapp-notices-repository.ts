import { supabase } from './client';
import type { Database } from './database.types';

export type VentaNoticeStatusRow = Database['public']['Views']['v_venta_whatsapp_notice_status']['Row'];
export type VentaRespuestaRow = Pick<
  Database['public']['Tables']['ventas']['Row'],
  'id' | 'respuesta_cliente' | 'respuesta_cliente_at'
>;

// Ultimo aviso por venta (estado real segun el webhook). Solo lectura.
export async function listVentaNoticeStatusRows(ventaIds: string[]): Promise<VentaNoticeStatusRow[]> {
  if (ventaIds.length === 0) return [];
  const { data, error } = await supabase
    .from('v_venta_whatsapp_notice_status')
    .select('*')
    .in('venta_id', ventaIds);
  if (error) throw error;
  return data ?? [];
}

// Respuestas de botones del cliente guardadas en la venta.
export async function listVentaRespuestaRows(ventaIds: string[]): Promise<VentaRespuestaRow[]> {
  if (ventaIds.length === 0) return [];
  const { data, error } = await supabase
    .from('ventas')
    .select('id, respuesta_cliente, respuesta_cliente_at')
    .in('id', ventaIds);
  if (error) throw error;
  return data ?? [];
}
