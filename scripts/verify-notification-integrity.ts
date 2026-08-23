import { config } from 'dotenv';

import type { Json, Tables } from '../src/platform/supabase/database.types';
import { getSupabaseAdmin } from './supabase-admin';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

type NotificationBase = Pick<
  Tables<'notificaciones'>,
  | 'id'
  | 'dedupe_key'
  | 'entidad'
  | 'tipo'
  | 'prioridad'
  | 'titulo'
  | 'mensaje'
  | 'dias_restantes'
  | 'scheduled_for'
  | 'leida'
  | 'resaltada'
  | 'created_at'
  | 'updated_at'
>;

type VentaDetail = Tables<'notificaciones_venta'>;
type ServicioDetail = Tables<'notificaciones_servicio'>;
type ReposoDetail = Tables<'notificaciones_reposo'>;

const REPAIR_WINDOW_START = '2026-08-17T15:17:55.000Z';
const REPAIR_WINDOW_END = '2026-08-17T15:18:00.000Z';

async function main() {
  const supabase = getSupabaseAdmin();
  const [bases, ventas, servicios, reposos, ventaViews, servicioViews, reposoViews] =
    await Promise.all([
      requireData<NotificationBase[]>(
        supabase
          .from('notificaciones')
          .select(
            'id,dedupe_key,entidad,tipo,prioridad,titulo,mensaje,dias_restantes,scheduled_for,leida,resaltada,created_at,updated_at',
          ),
        'notificaciones',
      ),
      requireData<VentaDetail[]>(
        supabase.from('notificaciones_venta').select('*'),
        'notificaciones_venta',
      ),
      requireData<ServicioDetail[]>(
        supabase.from('notificaciones_servicio').select('*'),
        'notificaciones_servicio',
      ),
      requireData<ReposoDetail[]>(
        supabase.from('notificaciones_reposo').select('*'),
        'notificaciones_reposo',
      ),
      requireData<Array<{ id: string | null }>>(
        supabase.from('v_notificaciones_venta').select('id'),
        'v_notificaciones_venta',
      ),
      requireData<Array<{ id: string | null }>>(
        supabase.from('v_notificaciones_servicio').select('id'),
        'v_notificaciones_servicio',
      ),
      requireData<Array<{ id: string | null }>>(
        supabase.from('v_notificaciones_reposo').select('id'),
        'v_notificaciones_reposo',
      ),
    ]);

  const baseIds = new Set(bases.map((row) => row.id));
  const ventaByNotification = indexByNotification(ventas);
  const servicioByNotification = indexByNotification(servicios);
  const reposoByNotification = indexByNotification(reposos);
  const visibleIds = new Set(
    [...ventaViews, ...servicioViews, ...reposoViews]
      .map((row) => row.id)
      .filter((id): id is string => Boolean(id)),
  );

  const invalidAggregates = bases.filter((base) => {
    const venta = ventaByNotification.get(base.id) ?? [];
    const servicio = servicioByNotification.get(base.id) ?? [];
    const reposo = reposoByNotification.get(base.id) ?? [];
    const detailCount = venta.length + servicio.length + reposo.length;
    if (detailCount !== 1) return true;
    if (base.entidad === 'venta') {
      return venta.length !== 1 || base.dedupe_key !== `venta:${venta[0].venta_id}`;
    }
    if (base.entidad === 'servicio') {
      return servicio.length !== 1 || base.dedupe_key !== `servicio:${servicio[0].servicio_id}`;
    }
    return reposo.length !== 1 || base.dedupe_key !== `reposo:${reposo[0].servicio_id}`;
  });

  const danglingDetails = [...ventas, ...servicios, ...reposos].filter(
    (detail) => !baseIds.has(detail.notificacion_id),
  );
  const hiddenAggregates = bases.filter((base) => !visibleIds.has(base.id));
  const repairedWindow = bases.filter(
    (base) =>
      base.created_at >= REPAIR_WINDOW_START && base.created_at < REPAIR_WINDOW_END,
  );
  const repairedWindowHidden = repairedWindow.filter((base) => !visibleIds.has(base.id));

  let rpcProbe: Record<string, unknown> | undefined;
  if (process.argv.includes('--probe-rpc')) {
    const candidate =
      repairedWindow.find((base) => base.entidad === 'venta') ??
      bases.find((base) => base.entidad === 'venta');
    if (!candidate) throw new Error('No venta notification is available for the RPC probe');
    const detail = ventaByNotification.get(candidate.id)?.[0];
    if (!detail) throw new Error('RPC probe candidate has no venta detail');
    rpcProbe = await probeRpc(candidate, detail);
  }

  const report = {
    aggregates: bases.length,
    details: {
      venta: ventas.length,
      servicio: servicios.length,
      reposo: reposos.length,
    },
    visible: {
      venta: ventaViews.length,
      servicio: servicioViews.length,
      reposo: reposoViews.length,
      total: visibleIds.size,
    },
    invalidAggregates: invalidAggregates.length,
    danglingDetails: danglingDetails.length,
    hiddenAggregates: hiddenAggregates.length,
    repairedWindow: repairedWindow.length,
    repairedWindowHidden: repairedWindowHidden.length,
    rpcProbe,
    status:
      invalidAggregates.length === 0 &&
      danglingDetails.length === 0 &&
      hiddenAggregates.length === 0 &&
      repairedWindowHidden.length === 0
        ? 'passed'
        : 'failed',
  };

  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'passed') process.exit(1);
}

async function probeRpc(base: NotificationBase, detail: VentaDetail) {
  const supabase = getSupabaseAdmin();
  const pBase: Json = {
    id: base.id,
    dedupe_key: base.dedupe_key,
    entidad: base.entidad,
    tipo: base.tipo,
    prioridad: base.prioridad,
    titulo: base.titulo,
    mensaje: base.mensaje,
    dias_restantes: base.dias_restantes,
    scheduled_for: base.scheduled_for,
    leida: base.leida,
    resaltada: base.resaltada,
  };
  const detailPayload = Object.fromEntries(
    Object.entries(detail).filter(([key]) => key !== 'notificacion_id'),
  );
  const args = {
    p_base: pBase,
    p_detail: detailPayload as Json,
    p_preserve_existing_state: true,
  };

  const results = await Promise.all([
    supabase.rpc('upsert_notification_aggregate', args),
    supabase.rpc('upsert_notification_aggregate', args),
  ]);
  for (const result of results) {
    if (result.error) throw new Error(`Concurrent RPC probe failed: ${result.error.message}`);
    if (result.data !== base.id) throw new Error('Concurrent RPC returned a different notification id');
  }

  const beforeRollback = await requireSingleBase(base.id);
  const invalidDetail = { ...detailPayload, ciclo_pago_snapshot: '__invalid__' } as Json;
  const rollbackResult = await supabase.rpc('upsert_notification_aggregate', {
    p_base: { ...pBase, titulo: '__notification_rollback_probe__' },
    p_detail: invalidDetail,
    p_preserve_existing_state: true,
  });
  if (!rollbackResult.error) throw new Error('Rollback RPC probe unexpectedly succeeded');

  const afterRollback = await requireSingleBase(base.id);
  if (
    afterRollback.titulo !== beforeRollback.titulo ||
    afterRollback.updated_at !== beforeRollback.updated_at
  ) {
    throw new Error('Failed RPC left a partial base-table update');
  }

  return {
    concurrentCalls: 2,
    authoritativeIdStable: true,
    rollbackPreservedBase: true,
    rejectedSqlState: rollbackResult.error.code,
  };
}

async function requireSingleBase(id: string): Promise<NotificationBase> {
  const result = await getSupabaseAdmin()
    .from('notificaciones')
    .select(
      'id,dedupe_key,entidad,tipo,prioridad,titulo,mensaje,dias_restantes,scheduled_for,leida,resaltada,created_at,updated_at',
    )
    .eq('id', id)
    .single();
  if (result.error) throw new Error(`Notification probe read failed: ${result.error.message}`);
  return result.data;
}

function indexByNotification<T extends { notificacion_id: string }>(rows: T[]) {
  const index = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = index.get(row.notificacion_id) ?? [];
    bucket.push(row);
    index.set(row.notificacion_id, bucket);
  }
  return index;
}

async function requireData<T>(
  request: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  label: string,
): Promise<T> {
  const { data, error } = await request;
  if (error) throw new Error(`${label} query failed: ${error.message}`);
  return data as T;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
