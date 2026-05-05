import type { FirestoreDoc, InsertRow, MigrationContext } from '../types';
import {
  asBoolean,
  asNumber,
  asOptionalString,
  asString,
  cleanRow,
  cycleOrDefault,
  toIso,
  upsertRows,
} from '../helpers';

export type CatalogResult = {
  categoryIds: Set<string>;
  categoryPlanTypeIds: Set<string>;
  metodoPagoIds: Set<string>;
  tipoGastoIds: Set<string>;
  usuarioIds: Set<string>;
};

export async function migrateMetodosPago(ctx: MigrationContext, metodos: FirestoreDoc[]) {
  await upsertRows(
    ctx,
    'metodos_pago',
    metodos.map((metodo) =>
      cleanRow({
        id: metodo.id,
        nombre: asString(metodo.nombre, 'Sin nombre'),
        tipo: normalizeEnum(asString(metodo.tipo), ['banco', 'yappy', 'paypal', 'binance', 'efectivo'], 'efectivo'),
        banco: asOptionalString(metodo.banco),
        pais: asString(metodo.pais, 'PA'),
        moneda: asString(metodo.moneda, 'USD').toUpperCase(),
        titular: asString(metodo.titular, 'Sin titular'),
        tipo_cuenta: normalizeOptionalEnum(metodo.tipoCuenta, ['ahorro', 'corriente', 'wallet', 'telefono', 'email']),
        identificador: asString(metodo.identificador, metodo.id),
        alias: asOptionalString(metodo.alias),
        notas: asOptionalString(metodo.notas),
        activo: asBoolean(metodo.activo, true),
        asociado_a: normalizeOptionalEnum(metodo.asociadoA, ['usuario', 'servicio']),
        email: asOptionalString(metodo.email),
        contrasena: asOptionalString(metodo.contrasena),
        numero_tarjeta: asOptionalString(metodo.numeroTarjeta),
        fecha_expiracion: asOptionalString(metodo.fechaExpiracion),
        created_at: toIso(metodo.createdAt),
        updated_at: toIso(metodo.updatedAt ?? metodo.createdAt),
        created_by: null,
      })
    )
  );
}

export function withMissingMetodoPagoPlaceholders(
  ctx: MigrationContext,
  metodos: FirestoreDoc[],
  refs: FirestoreDoc[][]
): FirestoreDoc[] {
  const existingIds = new Set(metodos.map((metodo) => metodo.id));
  const missingIds = new Set<string>();

  for (const rows of refs) {
    for (const row of rows) {
      const id = asString(row.metodoPagoId);
      if (id && !existingIds.has(id)) missingIds.add(id);
    }
  }

  if (missingIds.size === 0) return metodos;
  ctx.report.setCount('legacy.metodos_pago_missing_placeholders', missingIds.size);

  const placeholders = [...missingIds].sort().map((id) => ({
    id,
    nombre: id === 'pendiente' ? 'Pendiente (legacy)' : `Metodo legacy faltante ${id}`,
    tipo: 'efectivo',
    pais: 'PA',
    moneda: 'USD',
    titular: 'Legacy',
    identificador: id,
    alias: 'legacy-placeholder',
    notas: 'Placeholder creado por migracion para preservar referencias legacy faltantes.',
    activo: false,
    asociadoA: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  return [...metodos, ...placeholders];
}

export async function migrateCategorias(ctx: MigrationContext, categorias: FirestoreDoc[]) {
  const categoriaRows: InsertRow[] = [];
  const tipoRows: InsertRow[] = [];
  const planRows: InsertRow[] = [];

  for (const categoria of categorias) {
    categoriaRows.push(
      cleanRow({
        id: categoria.id,
        nombre: asString(categoria.nombre, 'Sin nombre'),
        tipo: normalizeEnum(asString(categoria.tipo), ['cliente', 'revendedor', 'ambos'], 'ambos'),
        tipo_categoria: normalizeOptionalEnum(categoria.tipoCategoria, ['plataforma_streaming', 'otros']),
        notas: asOptionalString(categoria.notas),
        activo: asBoolean(categoria.activo, true),
        created_at: toIso(categoria.createdAt),
        updated_at: toIso(categoria.updatedAt ?? categoria.createdAt),
        created_by: null,
      })
    );

    const tipos = Array.isArray(categoria.tiposPlanes)
      ? (categoria.tiposPlanes as FirestoreDoc[])
      : [];
    const seenTipoIds = new Set<string>();

    tipos.forEach((tipo, index) => {
      const id = asString(tipo.id, `${categoria.id}_tipo_${index + 1}`);
      seenTipoIds.add(id);
      tipoRows.push(
        cleanRow({
          id,
          categoria_id: categoria.id,
          nombre: asString(tipo.nombre, id),
          orden: index + 1,
          activo: true,
          created_at: toIso(categoria.createdAt),
          updated_at: toIso(categoria.updatedAt ?? categoria.createdAt),
        })
      );
    });

    const planes = Array.isArray(categoria.planes) ? (categoria.planes as FirestoreDoc[]) : [];
    planes.forEach((plan, index) => {
      const planTipoId = asString(plan.tipoPlan);
      if (!planTipoId) {
        ctx.report.warn('Plan without tipoPlan skipped', { categoriaId: categoria.id, planId: plan.id });
        return;
      }
      if (!seenTipoIds.has(planTipoId)) {
        seenTipoIds.add(planTipoId);
        tipoRows.push(
          cleanRow({
            id: planTipoId,
            categoria_id: categoria.id,
            nombre: planTipoId,
            orden: seenTipoIds.size,
            activo: true,
            created_at: toIso(categoria.createdAt),
            updated_at: toIso(categoria.updatedAt ?? categoria.createdAt),
          })
        );
        ctx.report.warn('Created missing plan type from plan.tipoPlan', {
          categoriaId: categoria.id,
          planTipoId,
        });
      }

      planRows.push(
        cleanRow({
          id: asString(plan.id, `${categoria.id}_plan_${index + 1}`),
          categoria_id: categoria.id,
          plan_tipo_id: planTipoId,
          nombre: asString(plan.nombre, 'Sin nombre'),
          precio: asNumber(plan.precio, 0),
          ciclo_pago: cycleOrDefault(plan.cicloPago),
          orden: index + 1,
          activo: true,
          created_at: toIso(categoria.createdAt),
          updated_at: toIso(categoria.updatedAt ?? categoria.createdAt),
        })
      );
    });
  }

  await upsertRows(ctx, 'categorias', categoriaRows);
  await upsertRows(ctx, 'planes_tipos', tipoRows);
  await upsertRows(ctx, 'planes', planRows);
}

export async function migrateUsuarios(
  ctx: MigrationContext,
  usuarios: FirestoreDoc[],
  metodoPagoIds: Set<string>
) {
  await upsertRows(
    ctx,
    'usuarios',
    usuarios.map((usuario) => {
      const metodoPagoId = asOptionalString(usuario.metodoPagoId);
      if (metodoPagoId && !metodoPagoIds.has(metodoPagoId)) {
        ctx.report.warn('Usuario references missing metodoPagoId', {
          usuarioId: usuario.id,
          metodoPagoId,
        });
      }
      return cleanRow({
        id: usuario.id,
        nombre: asString(usuario.nombre, 'Sin nombre'),
        apellido: asString(usuario.apellido, ''),
        tipo: normalizeEnum(asString(usuario.tipo), ['cliente', 'revendedor'], 'cliente'),
        telefono: asString(usuario.telefono, ''),
        email: asOptionalString(usuario.email),
        metodo_pago_id: metodoPagoId && metodoPagoIds.has(metodoPagoId) ? metodoPagoId : null,
        active: asBoolean(usuario.active, true),
        created_at: toIso(usuario.createdAt),
        updated_at: toIso(usuario.updatedAt ?? usuario.createdAt),
        created_by: null,
      });
    })
  );
}

export async function migrateTiposGasto(ctx: MigrationContext, tiposGasto: FirestoreDoc[]) {
  await upsertRows(
    ctx,
    'tipos_gasto',
    tiposGasto.map((tipo) =>
      cleanRow({
        id: tipo.id,
        nombre: asString(tipo.nombre, 'Sin nombre'),
        descripcion: asOptionalString(tipo.descripcion),
        activo: asBoolean(tipo.activo, true),
        created_at: toIso(tipo.createdAt),
        updated_at: toIso(tipo.updatedAt ?? tipo.createdAt),
      })
    )
  );
}

export async function migrateGastos(
  ctx: MigrationContext,
  gastos: FirestoreDoc[],
  tipoGastoIds: Set<string>
) {
  const rows: InsertRow[] = [];
  for (const gasto of gastos) {
    const tipoGastoId = asString(gasto.tipoGastoId);
    if (!tipoGastoIds.has(tipoGastoId)) {
      ctx.report.orphan('gastos', gasto.id, 'tipoGastoId missing', gasto);
      continue;
    }
    const money = ctx.currency.convert(ctx, gasto.monto, gasto.moneda ?? 'USD');
    rows.push(
      cleanRow({
        id: gasto.id,
        tipo_gasto_id: tipoGastoId,
        fecha: toIso(gasto.fecha).slice(0, 10),
        monto_original: money.original,
        moneda_original: money.currency,
        monto_usd: money.usd,
        exchange_rate: money.rate,
        detalle: asOptionalString(gasto.detalle),
        created_at: toIso(gasto.createdAt ?? gasto.fecha),
        updated_at: toIso(gasto.updatedAt ?? gasto.createdAt ?? gasto.fecha),
        created_by: null,
      })
    );
  }
  await upsertRows(ctx, 'gastos', rows);
}

export async function migrateTemplates(ctx: MigrationContext, templates: FirestoreDoc[]) {
  await upsertRows(
    ctx,
    'templates',
    templates.map((template) =>
      cleanRow({
        id: template.id,
        nombre: asString(template.nombre, 'Sin nombre'),
        tipo: normalizeEnum(
          asString(template.tipo),
          ['notificacion_regular', 'dia_pago', 'renovacion', 'suscripcion', 'cancelacion'],
          'notificacion_regular'
        ),
        contenido: asString(template.contenido),
        activo: asBoolean(template.activo, true),
        created_at: toIso(template.createdAt),
        updated_at: toIso(template.updatedAt ?? template.createdAt),
      })
    )
  );

  const placeholders = templates.flatMap((template) =>
    (Array.isArray(template.placeholders) ? template.placeholders : []).map((placeholder) =>
      cleanRow({
        template_id: template.id,
        placeholder: asString(placeholder),
      })
    )
  );
  await upsertRows(ctx, 'template_placeholders', placeholders, 'template_id,placeholder');
}

export async function migrateConfig(ctx: MigrationContext, configs: FirestoreDoc[]) {
  const config = configs.find((doc) => doc.id === 'global') ?? configs[0];
  if (!config) return;
  const notificaciones = config.notificaciones as Record<string, unknown> | undefined;
  const whatsapp = config.whatsapp as Record<string, unknown> | undefined;
  const dias = Array.isArray(notificaciones?.diasAntes) ? notificaciones.diasAntes : [];
  const diasAnticipacion = asNumber(dias[0], asNumber(config.notificacionesDiasAnticipacion, 7));

  await upsertRows(ctx, 'config', [
    cleanRow({
      id: 'global',
      notificaciones_dias_anticipacion: Math.min(60, Math.max(1, diasAnticipacion)),
      hora_envio: Math.min(23, Math.max(0, asNumber(notificaciones?.horaEnvio, 9))),
      whatsapp_prefijo: asString(whatsapp?.prefijoTelefono, '+507'),
      updated_at: toIso(config.updatedAt),
    }),
  ]);
}

export function buildCatalogResult(
  categorias: FirestoreDoc[],
  metodos: FirestoreDoc[],
  tiposGasto: FirestoreDoc[],
  usuarios: FirestoreDoc[]
): CatalogResult {
  const categoryPlanTypeIds = new Set<string>();
  for (const categoria of categorias) {
    const tipos = Array.isArray(categoria.tiposPlanes) ? (categoria.tiposPlanes as FirestoreDoc[]) : [];
    for (const tipo of tipos) categoryPlanTypeIds.add(`${categoria.id}:${asString(tipo.id)}`);
    const planes = Array.isArray(categoria.planes) ? (categoria.planes as FirestoreDoc[]) : [];
    for (const plan of planes) categoryPlanTypeIds.add(`${categoria.id}:${asString(plan.tipoPlan)}`);
  }
  return {
    categoryIds: new Set(categorias.map((categoria) => categoria.id)),
    categoryPlanTypeIds,
    metodoPagoIds: new Set(metodos.map((metodo) => metodo.id)),
    tipoGastoIds: new Set(tiposGasto.map((tipo) => tipo.id)),
    usuarioIds: new Set(usuarios.map((usuario) => usuario.id)),
  };
}

function normalizeEnum<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeOptionalEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  const normalized = asString(value);
  return allowed.includes(normalized as T) ? (normalized as T) : undefined;
}
