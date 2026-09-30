import { supabase } from './client';
import { toSnakeCase } from './mappers';
import { ENTITIES, writeTable, type CollectionName, type PublicTableName } from './entities';
import type { Database } from './database.types';
import { createLogger } from '@/platform/observability/logger';
import { assertRecordId, isUuid } from '@/platform/utils/safety';

const logger = createLogger('supabase records');

/**
 * Columnas escribibles por tabla para el path de escritura generico.
 *
 * Antes esto era una allowlist en texto libre que duplicaba el schema SQL y
 * `database.types.ts` (triple fuente de verdad). Ahora cada lista usa
 * `satisfies readonly (keyof Database['public']['Tables'][T]['Insert'])[]`,
 * asi el COMPILADOR verifica que cada columna existe en los tipos generados:
 * si el schema cambia y se regeneran los tipos, un nombre invalido rompe el build.
 *
 * Se excluyen a proposito las columnas gestionadas por la DB / por triggers
 * (`id`, `created_at`, `updated_at`, `perfiles_ocupados`): la app nunca las escribe.
 * Los pagos (pagos_venta / pagos_servicio) van por RPC dedicados (idempotentes),
 * no por este path, por eso no necesitan entrada aqui.
 */
type InsertKeys<T extends PublicTableName> = keyof Database['public']['Tables'][T]['Insert'];

const WRITABLE_COLUMNS = {
  terceros: [
    'nombre', 'apellido', 'tipo', 'telefono', 'email',
    'metodo_pago_id', 'active', 'notas', 'created_by',
  ] satisfies readonly InsertKeys<'terceros'>[],
  servicios: [
    'categoria_id', 'plan_tipo_id', 'nombre', 'correo', 'contrasena',
    'perfiles_disponibles', 'activo', 'en_reposo', 'dias_reposo',
    'fecha_inicio_reposo', 'fecha_fin_reposo', 'cortado_at', 'cortado_by',
    'motivo_corte', 'archivado_at', 'archivado_by', 'motivo_archivado',
    'notas', 'created_by',
  ] satisfies readonly InsertKeys<'servicios'>[],
  ventas: [
    'cliente_id', 'servicio_id', 'categoria_id', 'estado', 'perfil_numero',
    'perfil_nombre', 'codigo', 'cortada_at', 'cortada_by', 'motivo_corte',
    'archivado_at', 'archivado_by', 'motivo_archivado', 'notas', 'created_by',
  ] satisfies readonly InsertKeys<'ventas'>[],
  gastos: [
    'tipo_gasto_id', 'fecha', 'monto_original', 'moneda_original',
    'monto_usd', 'exchange_rate', 'detalle', 'created_by',
  ] satisfies readonly InsertKeys<'gastos'>[],
} satisfies Partial<Record<PublicTableName, readonly string[]>>;

function getWritableColumns(table: PublicTableName): readonly string[] | undefined {
  return (WRITABLE_COLUMNS as Partial<Record<PublicTableName, readonly string[]>>)[table];
}

export async function insertRawRow(
  table: PublicTableName,
  payload: Record<string, unknown>
): Promise<string> {
  const snake = toSnakeCase<Record<string, unknown>>(payload);
  const { data, error } = await supabase
    .from(table as never)
    .insert(snake as never)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return assertRecordId(data, `insert ${table}`);
}

export function normalizeWritePayload(
  collectionName: CollectionName,
  payload: Record<string, unknown>,
  mode: 'insert' | 'update'
): Record<string, unknown> {
  const snake = toSnakeCase<Record<string, unknown>>(payload);
  sanitizeUuidReferences(snake);

  if (collectionName === ENTITIES.SERVICIOS && snake.tipo !== undefined) {
    if (snake.plan_tipo_id === undefined) {
      snake.plan_tipo_id = snake.tipo;
    }
    delete snake.tipo;
  }
  if (collectionName === ENTITIES.GASTOS && snake.monto !== undefined) {
    if (snake.monto_original === undefined) snake.monto_original = snake.monto;
    if (snake.monto_usd === undefined) snake.monto_usd = snake.monto;
    if (snake.moneda_original === undefined) snake.moneda_original = 'USD';
    delete snake.monto;
  }

  const allowed = getWritableColumns(writeTable(collectionName));
  if (!allowed) return snake;

  const result: Record<string, unknown> = {};
  for (const key of allowed) {
    if (snake[key] !== undefined) result[key] = snake[key];
  }
  if (mode === 'update') {
    delete result.created_by;
  }
  sanitizeUuidReferences(result);

  if (process.env.NODE_ENV === 'development') {
    const dropped = Object.keys(snake).filter(
      (k) => !allowed.includes(k) && snake[k] !== undefined && k !== 'id'
    );
    if (dropped.length > 0) {
      logger.warn(
        `write to "${collectionName}" dropped fields not in allowlist: ${dropped.join(', ')}. ` +
        'These fields do not exist on the SQL table. Either add them to the allowlist or remove them from the caller.'
      );
    }
  }

  return result;
}

function sanitizeUuidReferences(row: Record<string, unknown>) {
  for (const key of ['created_by', 'archivado_by', 'cortado_by', 'cortada_by']) {
    if (row[key] !== undefined && !isUuid(row[key])) {
      row[key] = null;
    }
  }
}
