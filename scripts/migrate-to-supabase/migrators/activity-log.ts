import type { FirestoreDoc, MigrationContext } from '../types';
import { asString, cleanRow, toIso, upsertRows } from '../helpers';

const ACTIONS = ['creacion', 'actualizacion', 'eliminacion', 'renovacion'] as const;
const ENTITIES = [
  'cliente',
  'revendedor',
  'servicio',
  'usuario',
  'categoria',
  'metodo_pago',
  'gasto',
  'venta',
  'template',
] as const;

export async function migrateActivityLog(ctx: MigrationContext, logs: FirestoreDoc[]) {
  await upsertRows(
    ctx,
    'activity_log',
    logs.map((log) =>
      cleanRow({
        id: log.id,
        usuario_id: isUuid(asString(log.usuarioId)) ? asString(log.usuarioId) : null,
        usuario_email: asString(log.usuarioEmail, 'legacy@firebase.local'),
        accion: normalize(asString(log.accion), ACTIONS, 'actualizacion'),
        entidad: normalize(asString(log.entidad), ENTITIES, 'usuario'),
        entidad_id: asString(log.entidadId, log.id),
        entidad_nombre: asString(log.entidadNombre, 'Registro legacy'),
        detalles: asString(log.detalles),
        cambios: Array.isArray(log.cambios) ? (log.cambios as never) : null,
        timestamp: toIso(log.timestamp ?? log.createdAt),
      })
    )
  );
}

function normalize<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
