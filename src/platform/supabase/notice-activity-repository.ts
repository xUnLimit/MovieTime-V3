import type {
  NoticeActivityRow, NoticeOrigin, NoticeStatus, RecentNotice, RecentNoticeFilters, RecentNoticePage,
} from '@/types/automation';
import { supabase } from './client';

const RECENT_NOTICES_PAGE_SIZE = 10;
// PostgREST entrega como maximo 1000 filas por consulta: se pagina hasta cubrir los 30 dias.
const ACTIVITY_CHUNK = 1000;
const ACTIVITY_MAX_CHUNKS = 10;
const STATUSES: ReadonlySet<string> = new Set<NoticeStatus>(['pending', 'accepted', 'failed', 'skipped']);

function fail(action: string, error: { message: string }): never {
  // El mensaje original puede traer detalles de SQL: se conserva solo para el registro tecnico.
  throw new Error(`No se pudo ${action} de los avisos de WhatsApp.`, { cause: error.message });
}

/** Avisos creados desde `sinceIso` (solo tipo, estado y fecha), los mas nuevos primero. */
export async function listNoticeActivityRows(sinceIso: string): Promise<NoticeActivityRow[]> {
  const rows: NoticeActivityRow[] = [];
  for (let chunk = 0; chunk < ACTIVITY_MAX_CHUNKS; chunk += 1) {
    const start = chunk * ACTIVITY_CHUNK;
    const { data, error } = await supabase.from('whatsapp_notices').select('tipo,status,created_at')
      .gte('created_at', sinceIso).order('created_at', { ascending: false }).range(start, start + ACTIVITY_CHUNK - 1);
    if (error) fail('leer la actividad', error);
    const batch = data ?? [];
    rows.push(...batch.map((row) => ({ tipo: row.tipo, status: row.status, createdAt: row.created_at })));
    if (batch.length < ACTIVITY_CHUNK) break;
  }
  return rows;
}

function toRecent(row: {
  id: string; tipo: string; status: string; origin: string; created_at: string; wa_id: string; skip_reason: string | null;
  terceros: { nombre: string; apellido: string } | null;
}): RecentNotice {
  const origin: NoticeOrigin = row.origin === 'auto' ? 'auto' : 'manual';
  return {
    id: row.id, tipo: row.tipo, origin, createdAt: row.created_at, waId: row.wa_id, skipReason: row.skip_reason,
    status: STATUSES.has(row.status) ? row.status as NoticeStatus : 'pending',
    clienteNombre: row.terceros ? `${row.terceros.nombre} ${row.terceros.apellido}`.trim() : null,
  };
}

// page es 1-based. No se lee el contenido enviado: la tabla no lo guarda y la pantalla no debe mostrarlo.
export async function listRecentNotices(page: number, filters: RecentNoticeFilters): Promise<RecentNoticePage> {
  const safePage = Number.isInteger(page) && page >= 1 ? page : 1;
  const start = (safePage - 1) * RECENT_NOTICES_PAGE_SIZE;
  let query = supabase.from('whatsapp_notices')
    .select('id,tipo,status,origin,created_at,wa_id,skip_reason,terceros(nombre,apellido)', { count: 'exact' })
    .order('created_at', { ascending: false }).range(start, start + RECENT_NOTICES_PAGE_SIZE - 1);
  if (filters.tipo) query = query.eq('tipo', filters.tipo);
  if (filters.status) query = query.eq('status', filters.status);
  const { data, count, error } = await query;
  if (error) fail('listar el historial', error);
  return { notices: (data ?? []).map(toRecent), total: count ?? 0, page: safePage, pageSize: RECENT_NOTICES_PAGE_SIZE };
}
