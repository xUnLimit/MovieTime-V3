import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { z } from '@/platform/validation/zod';
import type { Database } from '@/platform/supabase/database.types';
import { normalizePanamaWaId, type NoticeVenta } from './message-data';

export type NoticeTipo = Database['public']['Enums']['tipo_template_enum'];
export type NoticeTemplate = { contenido: string; metaTemplateName: string | null; metaParamMap: string[];
  metaButtonActions: ('RENOVAR' | 'NO_CONTINUAR' | 'DATOS' | 'NINGUNA')[] };
export type NoticeRecord = Database['public']['Tables']['whatsapp_notices']['Row'];
type NoticeReservation = {
  dedupeKey: string; tipo: NoticeTipo; terceroId: string; waId: string;
  channel: 'template' | 'text'; metaTemplateName: string | null;
  fechaVencimiento: string | null; origin: 'manual' | 'auto';
  idempotencyKey: string; createdBy: string | null; ventaIds: string[];
};
export type NoticeStore = {
  loadVentas(ids: string[]): Promise<NoticeVenta[]>;
  loadTemplate(tipo: NoticeTipo): Promise<NoticeTemplate | null>;
  isAmbiguousPhone(waId: string, terceroId: string): Promise<boolean>;
  lastInboundAt(waId: string): Promise<string | null>;
  reserve(input: NoticeReservation): Promise<NoticeRecord>;
  finish(id: string, status: 'accepted' | 'failed' | 'skipped', outboundId: string | null,
    waMessageId: string | null, skipReason?: string): Promise<void>;
};

type ServiceClient = ReturnType<typeof createServiceRoleClient>;
const paramMapSchema = z.array(z.string());
const buttonActionsSchema = z.array(z.enum(['RENOVAR', 'NO_CONTINUAR', 'DATOS', 'NINGUNA']));
function check(error: { code?: string } | null, action: string): void {
  if (error) throw new Error(`Notice store ${action} failed: ${error.code ?? 'unknown'}`);
}
function dateOnly(value: string | null): Date | null {
  return value ? new Date(`${value}T12:00:00`) : null;
}

export function createNoticeStore(client: ServiceClient = createServiceRoleClient()): NoticeStore {
  return {
    async loadVentas(ids) {
      const { data: ventas, error } = await client.from('v_ventas_full')
        .select('id,cliente_id,cliente_nombre,cliente_telefono,categoria_nombre,servicio_nombre,perfil_nombre,servicio_correo,servicio_contrasena,codigo,ultima_fecha_fin,ultimo_total_original,ultima_moneda,estado,servicio_id,ultimo_periodo_id')
        .in('id', ids);
      check(error, 'load sales');
      if (!ventas?.length) return [];
      const ventaIds = ventas.flatMap((venta) => venta.id ? [venta.id] : []);
      const serviceIds = [...new Set(ventas.flatMap((venta) => venta.servicio_id ? [venta.servicio_id] : []))];
      const periodIds = [...new Set(ventas.flatMap((venta) => venta.ultimo_periodo_id ? [venta.ultimo_periodo_id] : []))];
      const [states, promises, refunds, responses] = await Promise.all([
        client.from('servicios').select('id,en_reposo,activo').in('id', serviceIds),
        client.from('v_notificaciones_venta').select('venta_id,fecha_prometida_pago').in('venta_id', ventaIds).not('fecha_prometida_pago', 'is', null),
        periodIds.length ? client.from('pagos_venta').select('venta_periodo_id,estado').in('venta_periodo_id', periodIds).eq('estado', 'reembolsado') : Promise.resolve({ data: [], error: null }),
        client.from('ventas').select('id,respuesta_cliente').in('id', ventaIds),
      ]);
      check(states.error, 'load service state'); check(promises.error, 'load promises');
      check(refunds.error, 'load refunds'); check(responses.error, 'load replies');
      const services = new Map((states.data ?? []).map((row) => [row.id, row]));
      const refunded = new Set((refunds.data ?? []).map((row) => row.venta_periodo_id));
      const replies = new Map((responses.data ?? []).map((row) => [row.id, row.respuesta_cliente]));
      const promiseDates = new Map<string, string>();
      for (const row of promises.data ?? []) {
        if (row.venta_id && row.fecha_prometida_pago && row.fecha_prometida_pago > (promiseDates.get(row.venta_id) ?? '')) {
          promiseDates.set(row.venta_id, row.fecha_prometida_pago);
        }
      }
      return ventas.flatMap((venta): NoticeVenta[] => {
        if (!venta.id || !venta.cliente_id) return [];
        const service = venta.servicio_id ? services.get(venta.servicio_id) : null;
        return [{
          ventaId: venta.id, clienteId: venta.cliente_id,
          clienteNombre: venta.cliente_nombre ?? '', telefono: venta.cliente_telefono ?? '',
          categoriaNombre: venta.categoria_nombre ?? '', servicioNombre: venta.servicio_nombre ?? '',
          perfilNombre: venta.perfil_nombre ?? '', correo: venta.servicio_correo ?? '',
          contrasena: venta.servicio_contrasena ?? '', codigo: venta.codigo ?? '',
          fechaVencimiento: dateOnly(venta.ultima_fecha_fin), monto: venta.ultimo_total_original ?? 0,
          moneda: venta.ultima_moneda ?? '', activa: venta.estado === 'activo' && service?.activo === true,
          reembolsada: !!venta.ultimo_periodo_id && refunded.has(venta.ultimo_periodo_id),
          enReposo: service?.en_reposo === true,
          promesaPagoHasta: dateOnly(promiseDates.get(venta.id) ?? null),
          respuestaCliente: replies.get(venta.id) === 'no_continuar' ? 'no_continuar' : null,
        }];
      });
    },
    async loadTemplate(tipo) {
      const { data, error } = await client.from('templates')
        .select('contenido,meta_template_name,meta_param_map,meta_button_actions')
        .eq('tipo', tipo).eq('activo', true).maybeSingle();
      check(error, 'load template');
      return data ? { contenido: data.contenido, metaTemplateName: data.meta_template_name,
        metaParamMap: paramMapSchema.parse(data.meta_param_map),
        metaButtonActions: buttonActionsSchema.parse(data.meta_button_actions) } : null;
    },
    async isAmbiguousPhone(waId, terceroId) {
      const { data, error } = await client.from('terceros').select('id,telefono').eq('active', true);
      check(error, 'check phone ambiguity');
      return (data ?? []).some((row) => row.id !== terceroId && normalizePanamaWaId(row.telefono) === waId);
    },
    async lastInboundAt(waId) {
      const { data, error } = await client.from('whatsapp_inbound_messages')
        .select('sent_at').eq('from_wa_id', waId).order('sent_at', { ascending: false }).limit(1).maybeSingle();
      check(error, 'load inbound time');
      return data?.sent_at ?? null;
    },
    async reserve(input) {
      const { data, error } = await client.rpc('reserve_whatsapp_notice', {
        p_dedupe_key: input.dedupeKey, p_tipo: input.tipo, p_tercero_id: input.terceroId,
        p_wa_id: input.waId, p_channel: input.channel, p_meta_template_name: input.metaTemplateName,
        p_fecha_vencimiento: input.fechaVencimiento, p_origin: input.origin,
        p_idempotency_key: input.idempotencyKey, p_created_by: input.createdBy, p_venta_ids: input.ventaIds,
      });
      check(error, 'reserve');
      if (!data) throw new Error('Notice reservation returned no row');
      return data;
    },
    async finish(id, status, outboundId, waMessageId, skipReason) {
      const { error } = await client.from('whatsapp_notices').update({ status,
        outbound_message_id: outboundId, wa_message_id: waMessageId,
        skip_reason: skipReason ?? null }).eq('id', id).eq('status', 'pending');
      check(error, 'finish');
    },
  };
}
