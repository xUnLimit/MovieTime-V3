import type {
  BotEvent, BotEventDetail, BotEventFilters, BotEventPage, BotEventType, BotStatus, BotVersionSummary,
} from '@/types/bot';
import { supabase } from './client';
import type { Json } from './database.types';
import { callRpc } from './rpc-client';

const BOT_EVENTS_PAGE_SIZE = 10;
const VERSIONS_LIMIT = 100;
const EVENT_TYPES: ReadonlySet<string> = new Set<BotEventType>([
  'menu_shown', 'option_selected', 'code_sent', 'link_sent', 'not_found', 'already_sent', 'profile_blocked',
  'rate_limited', 'mailbox_unavailable', 'handoff', 'option_unavailable', 'error',
]);

/** La definicion viaja sin validar: quien la consume la valida con el esquema del modulo bot-config. */
export type BotVersionRecord = { version: number; definition: unknown };
export type BotMetrics = { eventsLast24h: number; codesLast24h: number; lastActivityAt: string | null };

function fail(action: string, error: { message: string }): never {
  // El mensaje original puede traer detalles de SQL: se conserva solo para el registro tecnico.
  throw new Error(`No se pudo ${action} del bot.`, { cause: error.message });
}

function assertOnline(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Sin conexion: conectate para modificar el bot.');
  }
}

function assertRpcInteger(data: unknown, operation: string): number {
  if (typeof data !== 'number' || !Number.isInteger(data) || data < 1) {
    throw new Error(`${operation} no retorno una version valida`);
  }
  return data;
}

export async function getBotStatus(): Promise<BotStatus> {
  const { data, error } = await supabase.from('whatsapp_bot_config')
    .select('enabled,published_version,updated_at').eq('id', 'global').maybeSingle();
  if (error) fail('leer el estado', error);
  if (!data) return { enabled: false, publishedVersion: null, updatedAt: null };
  return { enabled: data.enabled, publishedVersion: data.published_version, updatedAt: data.updated_at };
}

export async function getBotVersion(version: number): Promise<BotVersionRecord | null> {
  const { data, error } = await supabase.from('whatsapp_bot_versions')
    .select('version,definition').eq('version', version).maybeSingle();
  if (error) fail('leer la version', error);
  return data ? { version: data.version, definition: data.definition } : null;
}

export async function listBotVersions(publishedVersion: number | null): Promise<BotVersionSummary[]> {
  const { data, error } = await supabase.from('whatsapp_bot_versions')
    .select('version,note,created_at,created_by').order('version', { ascending: false }).limit(VERSIONS_LIMIT);
  if (error) fail('listar las versiones', error);
  return (data ?? []).map((row) => ({
    version: row.version, note: row.note, createdAt: row.created_at, createdBy: row.created_by,
    isPublished: row.version === publishedVersion,
  }));
}

// Publicar crea la version y fija la publicada en una sola transaccion SQL.
export async function publishBotVersion(definition: Json, note: string): Promise<number> {
  assertOnline();
  const { data, error } = await callRpc('publish_whatsapp_bot_version', {
    p_definition: definition, p_note: note,
  });
  if (error) fail('publicar la version', error);
  return assertRpcInteger(data, 'publish_whatsapp_bot_version');
}

export async function setBotEnabled(enabled: boolean): Promise<boolean> {
  assertOnline();
  const { data, error } = await callRpc('set_whatsapp_bot_enabled', { p_enabled: enabled });
  if (error) fail('cambiar el interruptor', error);
  if (typeof data !== 'boolean') throw new Error('set_whatsapp_bot_enabled no retorno un booleano');
  return data;
}

function readDetail(value: unknown): BotEventDetail {
  const detail: BotEventDetail = {};
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (item === null || typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') detail[key] = item;
    }
  }
  return detail;
}

function toEvent(row: {
  id: string; created_at: string; wa_id: string; cliente_id: string | null; type: string; node_id: string | null;
  option_id: string | null; detail: unknown; terceros: { nombre: string; apellido: string } | null;
}): BotEvent {
  return {
    id: row.id, createdAt: row.created_at, waId: row.wa_id, clienteId: row.cliente_id,
    clienteNombre: row.terceros ? `${row.terceros.nombre} ${row.terceros.apellido}`.trim() : null,
    type: EVENT_TYPES.has(row.type) ? row.type as BotEventType : 'error',
    nodeId: row.node_id, optionId: row.option_id, detail: readDetail(row.detail),
  };
}

function isoOrNull(value: string | undefined): string | null {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

// page es 1-based; el telefono se filtra solo por sus digitos para no interpolar texto libre en el patron.
export async function listBotEvents(page: number, filters: BotEventFilters): Promise<BotEventPage> {
  const safePage = Number.isInteger(page) && page >= 1 ? page : 1;
  const start = (safePage - 1) * BOT_EVENTS_PAGE_SIZE;
  let query = supabase.from('whatsapp_bot_events')
    .select('id,created_at,wa_id,cliente_id,type,node_id,option_id,detail,terceros(nombre,apellido)', { count: 'exact' })
    .order('created_at', { ascending: false }).range(start, start + BOT_EVENTS_PAGE_SIZE - 1);
  if (filters.type) query = query.eq('type', filters.type);
  const digits = filters.waId?.replace(/\D/g, '');
  if (digits) query = query.ilike('wa_id', `%${digits}%`);
  const from = isoOrNull(filters.from);
  const to = isoOrNull(filters.to);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);
  const { data, count, error } = await query;
  if (error) fail('listar la actividad', error);
  return { events: (data ?? []).map(toEvent), total: count ?? 0, page: safePage, pageSize: BOT_EVENTS_PAGE_SIZE };
}

export async function getBotMetrics(now: Date = new Date()): Promise<BotMetrics> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const [events, codes, last] = await Promise.all([
    supabase.from('whatsapp_bot_events').select('id', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('whatsapp_bot_events').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('type', 'code_sent'),
    supabase.from('whatsapp_bot_events').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (events.error) fail('leer las metricas', events.error);
  if (codes.error) fail('leer las metricas', codes.error);
  if (last.error) fail('leer las metricas', last.error);
  return { eventsLast24h: events.count ?? 0, codesLast24h: codes.count ?? 0, lastActivityAt: last.data?.created_at ?? null };
}
