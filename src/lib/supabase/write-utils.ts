import { supabase } from './client';
import { toSnakeCase } from './mappers';
import { ENTITIES, type CollectionName, type PublicTableName } from './entities';

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
  return (data as { id: string }).id;
}

export function normalizeWritePayload(
  collectionName: CollectionName,
  payload: Record<string, unknown>,
  mode: 'insert' | 'update'
): Record<string, unknown> {
  const snake = toSnakeCase<Record<string, unknown>>(payload);
  sanitizeUuidReferences(snake);
  const allowedByCollection: Partial<Record<CollectionName, string[]>> = {
    usuarios: [
      'nombre',
      'apellido',
      'tipo',
      'telefono',
      'email',
      'metodo_pago_id',
      'active',
      'notas',
      'created_by',
    ],
    servicios: [
      'categoria_id',
      'plan_tipo_id',
      'nombre',
      'correo',
      'contrasena',
      'perfiles_disponibles',
      'perfiles_ocupados',
      'activo',
      'en_reposo',
      'dias_reposo',
      'fecha_inicio_reposo',
      'fecha_fin_reposo',
      'cortado_at',
      'cortado_by',
      'motivo_corte',
      'archivado_at',
      'archivado_by',
      'motivo_archivado',
      'notas',
      'created_by',
    ],
    ventas: [
      'cliente_id',
      'servicio_id',
      'categoria_id',
      'estado',
      'perfil_numero',
      'perfil_nombre',
      'codigo',
      'cortada_at',
      'cortada_by',
      'motivo_corte',
      'archivado_at',
      'archivado_by',
      'motivo_archivado',
      'notas',
      'created_by',
    ],
    gastos: [
      'tipo_gasto_id',
      'fecha',
      'monto_original',
      'moneda_original',
      'monto_usd',
      'exchange_rate',
      'detalle',
      'created_by',
    ],
    pagosServicio: [
      'servicio_periodo_id',
      'servicio_id',
      'fecha_pago',
      'estado',
      'monto_original',
      'moneda_original',
      'monto_usd',
      'exchange_rate',
      'categoria_id_snapshot',
      'metodo_pago_id',
      'metodo_pago_nombre_snapshot',
      'notas',
      'created_by',
      'anulada_at',
      'anulada_by',
      'motivo_anulacion',
    ],
    pagosVenta: [
      'venta_periodo_id',
      'venta_id',
      'fecha_pago',
      'estado',
      'monto_original',
      'moneda_original',
      'monto_usd',
      'exchange_rate',
      'metodo_pago_id',
      'metodo_pago_nombre_snapshot',
      'notas',
      'created_by',
      'anulada_at',
      'anulada_by',
      'motivo_anulacion',
    ],
  };

  if (collectionName === ENTITIES.SERVICIOS && snake.tipo && !snake.plan_tipo_id) {
    snake.plan_tipo_id = snake.tipo;
  }
  if (collectionName === ENTITIES.GASTOS && snake.monto && !snake.monto_original) {
    snake.monto_original = snake.monto;
    snake.monto_usd = snake.monto;
    snake.moneda_original = 'USD';
  }

  const allowed = allowedByCollection[collectionName];
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
      console.warn(
        `[supabase records] write to "${collectionName}" dropped fields not in allowlist: ${dropped.join(', ')}\n` +
        'These fields do not exist on the SQL table. Either add them to the allowlist or remove them from the caller.'
      );
    }
  }

  return result;
}

function sanitizeUuidReferences(row: Record<string, unknown>) {
  for (const key of ['created_by', 'archivado_by', 'cortado_by', 'cortada_by']) {
    if (row[key] !== undefined && !isUuid(String(row[key]))) {
      row[key] = null;
    }
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
