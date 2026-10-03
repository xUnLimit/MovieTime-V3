import { supabase } from './client';
import { assertUuid, isUuid } from '@/platform/utils/safety';
import { z } from '@/platform/validation/zod';
import type { Database } from './database.types';

export type YappyPayment = {
  id: string; confirmationCode: string; amount: number; payerNameShort: string;
  payerPhoneLast4: string; paidAt: string; matchStatus: string;
  candidateVentaIds: string[]; matchedVentaId: string | null;
  requiereRevision: boolean; revisionPedidoId: string | null; revisionMotivo: string | null;
};
export type YappyConnectionStatus = { mailbox: string; status: string; lastSyncedAt: string | null; lastErrorCode: string | null };
export type YappyCandidateVenta = { id: string; cliente: string; servicio: string; perfil: string; fechaFin: string; precio: number };
type CandidateRow = Database['public']['Views']['v_yappy_candidate_ventas']['Row'];
const searchSchema = z.string().trim().min(2).max(80).regex(/^[\p{L}\p{N}\s.\-]+$/u);

function mapCandidateVentas(rows: CandidateRow[]): YappyCandidateVenta[] {
  return rows.flatMap((row) => row.id ? [{ id: row.id, cliente: row.cliente ?? '',
    servicio: row.servicio ?? '', perfil: row.perfil_nombre || (row.perfil_numero ? `Perfil ${row.perfil_numero}` : '—'),
    fechaFin: row.fecha_fin ?? '', precio: row.total_original ?? 0 }] : []);
}

export async function listYappyPayments(): Promise<YappyPayment[]> {
  const { data, error } = await supabase.from('yappy_payments').select('id,confirmation_code,amount,payer_name_short,payer_phone_last4,paid_at,match_status,candidate_venta_ids,matched_venta_id,requiere_revision,revision_pedido_id,revision_motivo').order('paid_at', { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, confirmationCode: row.confirmation_code,
    amount: row.amount, payerNameShort: row.payer_name_short, payerPhoneLast4: row.payer_phone_last4,
    paidAt: row.paid_at, matchStatus: row.match_status, candidateVentaIds: row.candidate_venta_ids,
    matchedVentaId: row.matched_venta_id, requiereRevision: row.requiere_revision,
    revisionPedidoId: row.revision_pedido_id, revisionMotivo: row.revision_motivo }));
}

export async function listYappyConnections(): Promise<YappyConnectionStatus[]> {
  const { data, error } = await supabase.from('v_yappy_mail_sync_status').select('*');
  if (error) throw error;
  return (data ?? []).flatMap((row) => row.status ? [{ mailbox: row.mailbox ?? '',
    status: row.status, lastSyncedAt: row.last_synced_at, lastErrorCode: row.last_error_code }] : []);
}

export async function listYappyCandidateVentas(candidateIds: string[] = []): Promise<YappyCandidateVenta[]> {
  const { data, error } = await supabase.from('v_yappy_candidate_ventas').select('*').order('fecha_fin', { ascending: false }).limit(500);
  if (error) throw error;
  const rows = [...(data ?? [])];
  const missing = [...new Set(candidateIds.map((id) => assertUuid(id, 'venta')))].filter((id) => !rows.some((row) => row.id === id));
  for (let index = 0; index < missing.length; index += 50) {
    const { data: extra, error: extraError } = await supabase.from('v_yappy_candidate_ventas').select('*').in('id', missing.slice(index, index + 50));
    if (extraError) throw extraError;
    rows.push(...(extra ?? []));
  }
  return mapCandidateVentas(rows);
}

export async function searchYappyCandidateVentas(input: string): Promise<YappyCandidateVenta[]> {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return [];
  const term = parsed.data;
  const searches = [
    supabase.from('v_yappy_candidate_ventas').select('*').ilike('cliente', `%${term}%`).limit(25),
    supabase.from('v_yappy_candidate_ventas').select('*').ilike('servicio', `%${term}%`).limit(25),
    ...(isUuid(term) ? [supabase.from('v_yappy_candidate_ventas').select('*').eq('id', term).limit(1)] : []),
  ];
  const results = await Promise.all(searches);
  const rows: CandidateRow[] = [];
  for (const result of results) {
    if (result.error) throw result.error;
    rows.push(...(result.data ?? []));
  }
  return mapCandidateVentas([...new Map(rows.filter((row) => row.id).map((row) => [row.id, row])).values()]);
}

export async function resolveYappyPayment(paymentId: string, ventaId: string): Promise<void> {
  const { error } = await supabase.rpc('resolve_yappy_payment', { p_payment_id: assertUuid(paymentId, 'pago'), p_venta_id: assertUuid(ventaId, 'venta') });
  if (error) throw error;
}

export async function dismissYappyPayment(paymentId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('dismiss_yappy_payment', { p_payment_id: assertUuid(paymentId, 'pago'), p_note: note });
  if (error) throw error;
}
