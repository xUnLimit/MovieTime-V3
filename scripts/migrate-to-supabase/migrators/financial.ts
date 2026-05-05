import type { FirestoreDoc, InsertRow, MigrationContext, PeriodSeed } from '../types';
import type { CatalogResult } from './catalogs';
import {
  asBoolean,
  asNumber,
  asOptionalString,
  asString,
  cleanRow,
  cycleOrDefault,
  requiredDateOnly,
  toDateOnly,
  toIso,
  upsertRows,
} from '../helpers';

type PaymentGroup = Map<string, FirestoreDoc[]>;

export async function migrateServiciosFinancial(
  ctx: MigrationContext,
  servicios: FirestoreDoc[],
  pagosServicio: FirestoreDoc[],
  catalogs: CatalogResult
) {
  const pagosByServicio = groupBy(pagosServicio, 'servicioId');
  const servicioRows: InsertRow[] = [];
  const periodoRows: InsertRow[] = [];
  const pagoRows: InsertRow[] = [];

  for (const servicio of servicios) {
    const categoriaId = asString(servicio.categoriaId);
    if (!catalogs.categoryIds.has(categoriaId)) {
      ctx.report.orphan('servicios', servicio.id, 'categoriaId missing', servicio);
      continue;
    }

    const planTipoId = asOptionalString(servicio.tipo);
    const validPlanTipo = planTipoId && catalogs.categoryPlanTypeIds.has(`${categoriaId}:${planTipoId}`);
    if (planTipoId && !validPlanTipo) {
      ctx.report.warn('Servicio references missing plan tipo; storing null plan_tipo_id', {
        servicioId: servicio.id,
        categoriaId,
        planTipoId,
      });
    }

    const perfilesDisponibles = Math.max(0, Math.trunc(asNumber(servicio.perfilesDisponibles, 0)));
    const perfilesOcupados = Math.min(
      perfilesDisponibles,
      Math.max(0, Math.trunc(asNumber(servicio.perfilesOcupados, 0)))
    );

    servicioRows.push(
      cleanRow({
        id: servicio.id,
        categoria_id: categoriaId,
        plan_tipo_id: validPlanTipo ? planTipoId : null,
        nombre: asString(servicio.nombre, 'Sin nombre'),
        correo: asString(servicio.correo),
        contrasena: asString(servicio.contrasena),
        perfiles_disponibles: perfilesDisponibles,
        perfiles_ocupados: perfilesOcupados,
        activo: asBoolean(servicio.activo, true),
        en_reposo: asBoolean(servicio.enReposo, false),
        dias_reposo: asNumber(servicio.diasReposo, 0) || null,
        fecha_inicio_reposo: toDateOnly(servicio.fechaInicioReposo) ?? null,
        fecha_fin_reposo: toDateOnly(servicio.fechaFinReposo) ?? null,
        notas: asOptionalString(servicio.notas),
        created_at: toIso(servicio.createdAt),
        updated_at: toIso(servicio.updatedAt ?? servicio.createdAt),
        created_by: null,
      })
    );

    const servicePayments = sortByPeriod(pagosByServicio.get(servicio.id) ?? []);
    const periods = buildServicioPeriods(ctx, servicio, servicePayments);
    periodoRows.push(...periods.rows);

    for (const pago of servicePayments) {
      const periodId = periods.paymentPeriodById.get(pago.id);
      if (!periodId) {
        ctx.report.orphan('pagosServicio', pago.id, 'insufficient period dates', pago);
        continue;
      }
      const metodoPagoId = asOptionalString(pago.metodoPagoId);
      if (metodoPagoId && !catalogs.metodoPagoIds.has(metodoPagoId)) {
        ctx.report.warn('PagoServicio references missing metodoPagoId', {
          pagoId: pago.id,
          metodoPagoId,
        });
      }
      const money = ctx.currency.convert(ctx, pago.monto, pago.moneda ?? servicio.moneda ?? 'USD');
      pagoRows.push(
        cleanRow({
          id: pago.id,
          servicio_periodo_id: periodId,
          servicio_id: servicio.id,
          fecha_pago: toIso(pago.fecha ?? pago.createdAt),
          estado: 'registrado',
          monto_original: money.original,
          moneda_original: money.currency,
          monto_usd: money.usd,
          exchange_rate: money.rate,
          metodo_pago_id: metodoPagoId && catalogs.metodoPagoIds.has(metodoPagoId) ? metodoPagoId : null,
          metodo_pago_nombre_snapshot: asOptionalString(pago.metodoPagoNombre),
          notas: asOptionalString(pago.notas),
          created_at: toIso(pago.createdAt ?? pago.fecha),
          created_by: null,
        })
      );
    }
  }

  for (const pago of pagosServicio) {
    const servicioId = asString(pago.servicioId);
    if (!servicios.some((servicio) => servicio.id === servicioId)) {
      ctx.report.orphan('pagosServicio', pago.id, 'servicioId missing', pago);
    }
  }

  await upsertRows(ctx, 'servicios', servicioRows);
  await upsertRows(ctx, 'servicio_periodos', periodoRows);
  await upsertRows(ctx, 'pagos_servicio', pagoRows);
}

export async function migrateVentasFinancial(
  ctx: MigrationContext,
  ventas: FirestoreDoc[],
  pagosVenta: FirestoreDoc[],
  servicios: FirestoreDoc[],
  catalogs: CatalogResult
) {
  const serviciosById = new Map(servicios.map((servicio) => [servicio.id, servicio]));
  const pagosByVenta = groupBy(pagosVenta, 'ventaId');
  const ventaRows: InsertRow[] = [];
  const periodoRows: InsertRow[] = [];
  const pagoRows: InsertRow[] = [];
  const activeProfiles = new Set<string>();

  for (const venta of ventas) {
    const servicioId = asString(venta.servicioId);
    const servicio = serviciosById.get(servicioId);
    if (!servicio) {
      ctx.report.orphan('ventas', venta.id, 'servicioId missing', venta);
      continue;
    }

    const categoriaId = asString(venta.categoriaId, asString(servicio.categoriaId));
    if (!catalogs.categoryIds.has(categoriaId)) {
      ctx.report.orphan('ventas', venta.id, 'categoriaId missing', venta);
      continue;
    }

    const clienteId = asOptionalString(venta.clienteId);
    if (clienteId && !catalogs.usuarioIds.has(clienteId)) {
      ctx.report.warn('Venta references missing clienteId; storing null cliente_id', {
        ventaId: venta.id,
        clienteId,
      });
    }

    const estado = asString(venta.estado, 'activo') === 'inactivo' ? 'inactivo' : 'activo';
    const perfilNumero = nullableInteger(venta.perfilNumero);
    let finalEstado = estado;
    if (estado === 'activo' && perfilNumero != null) {
      const activeKey = `${servicioId}:${perfilNumero}`;
      if (activeProfiles.has(activeKey)) {
        finalEstado = 'inactivo';
        ctx.report.warn('Duplicate active venta profile; marking later row inactive for migration', {
          ventaId: venta.id,
          servicioId,
          perfilNumero,
        });
      } else {
        activeProfiles.add(activeKey);
      }
    }

    ventaRows.push(
      cleanRow({
        id: venta.id,
        cliente_id: clienteId && catalogs.usuarioIds.has(clienteId) ? clienteId : null,
        servicio_id: servicioId,
        categoria_id: categoriaId,
        estado: finalEstado,
        perfil_numero: perfilNumero,
        perfil_nombre: asOptionalString(venta.perfilNombre),
        codigo: asOptionalString(venta.codigo),
        cortada_at: finalEstado === 'inactivo' ? toIso(venta.updatedAt ?? venta.createdAt) : null,
        motivo_corte: finalEstado === 'inactivo' ? 'Migrado como inactivo desde Firestore' : null,
        notas: asOptionalString(venta.notas),
        created_at: toIso(venta.createdAt),
        updated_at: toIso(venta.updatedAt ?? venta.createdAt),
        created_by: null,
      })
    );

    const salePayments = sortByPeriod(pagosByVenta.get(venta.id) ?? []);
    const periods = buildVentaPeriods(ctx, venta, salePayments);
    periodoRows.push(...periods.rows);

    for (const pago of salePayments) {
      const periodId = periods.paymentPeriodById.get(pago.id);
      if (!periodId) {
        ctx.report.orphan('pagosVenta', pago.id, 'insufficient period dates', pago);
        continue;
      }
      const metodoPagoId = asOptionalString(pago.metodoPagoId);
      if (metodoPagoId && !catalogs.metodoPagoIds.has(metodoPagoId)) {
        ctx.report.warn('PagoVenta references missing metodoPagoId', {
          pagoId: pago.id,
          metodoPagoId,
        });
      }
      const money = ctx.currency.convert(ctx, pago.monto ?? pago.total, pago.moneda ?? venta.moneda ?? 'USD');
      pagoRows.push(
        cleanRow({
          id: pago.id,
          venta_periodo_id: periodId,
          venta_id: venta.id,
          fecha_pago: toIso(pago.fecha ?? pago.createdAt),
          estado: 'registrado',
          monto_original: money.original,
          moneda_original: money.currency,
          monto_usd: money.usd,
          exchange_rate: money.rate,
          metodo_pago_id: metodoPagoId && catalogs.metodoPagoIds.has(metodoPagoId) ? metodoPagoId : null,
          metodo_pago_nombre_snapshot: asOptionalString(pago.metodoPago ?? pago.metodoPagoNombre),
          notas: asOptionalString(pago.notas),
          created_at: toIso(pago.createdAt ?? pago.fecha),
          created_by: null,
        })
      );
    }
  }

  for (const pago of pagosVenta) {
    const ventaId = asString(pago.ventaId);
    if (!ventas.some((venta) => venta.id === ventaId)) {
      ctx.report.orphan('pagosVenta', pago.id, 'ventaId missing', pago);
    }
  }

  await upsertRows(ctx, 'ventas', ventaRows);
  await upsertRows(ctx, 'venta_periodos', periodoRows);
  await upsertRows(ctx, 'pagos_venta', pagoRows);
}

function buildServicioPeriods(ctx: MigrationContext, servicio: FirestoreDoc, payments: FirestoreDoc[]) {
  const periods = new Map<string, { seed: PeriodSeed; amount: number; currency: string; auto: boolean }>();
  const paymentPeriodById = new Map<string, string>();

  for (const pago of payments) {
    const seed = periodSeedFromPayment(
      `${servicio.id}_periodo`,
      servicio.id,
      pago,
      servicio.fechaInicio,
      servicio.fechaVencimiento,
      asBoolean(pago.isPagoInicial, false)
    );
    if (!seed) continue;
    const key = periodKey(seed);
    const existing = periods.get(key);
    const amount = asNumber(pago.monto, 0);
    if (existing) {
      existing.amount += amount;
    } else {
      periods.set(key, {
        seed: { ...seed, numero: periods.size + 1 },
        amount,
        currency: asString(pago.moneda ?? servicio.moneda, 'USD'),
        auto: asBoolean(servicio.renovacionAutomatica, false),
      });
    }
    paymentPeriodById.set(pago.id, `${servicio.id}_periodo_${periods.get(key)?.seed.numero ?? periods.size}`);
  }

  if (periods.size === 0 && servicio.fechaInicio && servicio.fechaVencimiento) {
    const seed = {
      id: `${servicio.id}_periodo_1`,
      parentId: servicio.id,
      numero: 1,
      tipo: 'inicial' as const,
      fechaInicio: requiredDateOnly(servicio.fechaInicio),
      fechaFin: requiredDateOnly(servicio.fechaVencimiento),
      cicloPago: cycleOrDefault(servicio.cicloPago),
      createdAt: toIso(servicio.createdAt),
    };
    periods.set(periodKey(seed), {
      seed,
      amount: asNumber(servicio.costoServicio, 0),
      currency: asString(servicio.moneda, 'USD'),
      auto: asBoolean(servicio.renovacionAutomatica, false),
    });
  }

  const rows = [...periods.values()].map((period) => {
    const money = ctx.currency.convert(ctx, period.amount, period.currency);
    return cleanRow({
      id: `${servicio.id}_periodo_${period.seed.numero}`,
      servicio_id: servicio.id,
      numero_periodo: period.seed.numero,
      tipo: period.seed.tipo,
      fecha_inicio: period.seed.fechaInicio,
      fecha_vencimiento: period.seed.fechaFin,
      ciclo_pago: period.seed.cicloPago,
      costo_original: money.original,
      moneda_original: money.currency,
      costo_usd: money.usd,
      exchange_rate: money.rate,
      renovacion_automatica: period.auto,
      created_at: period.seed.createdAt,
      created_by: null,
    });
  });

  return { rows, paymentPeriodById };
}

function buildVentaPeriods(ctx: MigrationContext, venta: FirestoreDoc, payments: FirestoreDoc[]) {
  const periods = new Map<string, { seed: PeriodSeed; precio: number; descuento: number; total: number; currency: string }>();
  const paymentPeriodById = new Map<string, string>();

  for (const pago of payments) {
    const seed = periodSeedFromPayment(
      `${venta.id}_periodo`,
      venta.id,
      pago,
      venta.fechaInicio,
      venta.fechaFin,
      asBoolean(pago.isPagoInicial, false)
    );
    if (!seed) continue;
    const key = periodKey(seed);
    const total = asNumber(pago.monto ?? pago.total, 0);
    const precio = asNumber(pago.precio, asNumber(venta.precio, total));
    const descuento = asNumber(pago.descuento, asNumber(venta.descuento, 0));
    const existing = periods.get(key);
    if (existing) {
      existing.total += total;
    } else {
      periods.set(key, {
        seed: { ...seed, numero: periods.size + 1 },
        precio,
        descuento,
        total,
        currency: asString(pago.moneda ?? venta.moneda, 'USD'),
      });
    }
    paymentPeriodById.set(pago.id, `${venta.id}_periodo_${periods.get(key)?.seed.numero ?? periods.size}`);
  }

  if (periods.size === 0 && venta.fechaInicio && venta.fechaFin) {
    const total = asNumber(venta.precioFinal ?? venta.totalVenta ?? venta.precio, 0);
    const seed = {
      id: `${venta.id}_periodo_1`,
      parentId: venta.id,
      numero: 1,
      tipo: 'inicial' as const,
      fechaInicio: requiredDateOnly(venta.fechaInicio),
      fechaFin: requiredDateOnly(venta.fechaFin),
      cicloPago: cycleOrDefault(venta.cicloPago),
      createdAt: toIso(venta.createdAt),
    };
    periods.set(periodKey(seed), {
      seed,
      precio: asNumber(venta.precio, total),
      descuento: asNumber(venta.descuento, 0),
      total,
      currency: asString(venta.moneda, 'USD'),
    });
  }

  const rows = [...periods.values()].map((period) => {
    const money = ctx.currency.convert(ctx, period.total, period.currency);
    return cleanRow({
      id: `${venta.id}_periodo_${period.seed.numero}`,
      venta_id: venta.id,
      numero_periodo: period.seed.numero,
      tipo: period.seed.tipo,
      fecha_inicio: period.seed.fechaInicio,
      fecha_fin: period.seed.fechaFin,
      ciclo_pago: period.seed.cicloPago,
      plan_id: null,
      plan_nombre_snapshot: asOptionalString(venta.itemId),
      plan_tipo_nombre_snapshot: null,
      precio_original: period.precio,
      descuento: Math.min(100, Math.max(0, period.descuento)),
      total_original: money.original,
      moneda_original: money.currency,
      total_usd: money.usd,
      exchange_rate: money.rate,
      created_at: period.seed.createdAt,
      created_by: null,
    });
  });

  return { rows, paymentPeriodById };
}

function periodSeedFromPayment(
  idPrefix: string,
  parentId: string,
  payment: FirestoreDoc,
  fallbackStart: unknown,
  fallbackEnd: unknown,
  isInitial: boolean
): PeriodSeed | null {
  const fechaInicio = toDateOnly(payment.fechaInicio) ?? toDateOnly(fallbackStart);
  const fechaFin = toDateOnly(payment.fechaVencimiento) ?? toDateOnly(fallbackEnd);
  if (!fechaInicio || !fechaFin) return null;
  return {
    id: `${idPrefix}_pending`,
    parentId,
    numero: 0,
    tipo: isInitial ? 'inicial' : 'renovacion',
    fechaInicio,
    fechaFin,
    cicloPago: cycleOrDefault(payment.cicloPago),
    createdAt: toIso(payment.createdAt ?? payment.fecha),
  };
}

function groupBy(rows: FirestoreDoc[], field: string): PaymentGroup {
  const grouped = new Map<string, FirestoreDoc[]>();
  for (const row of rows) {
    const key = asString(row[field]);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return grouped;
}

function sortByPeriod(rows: FirestoreDoc[]): FirestoreDoc[] {
  return [...rows].sort((a, b) => {
    const aDate = toIso(a.fechaInicio ?? a.createdAt ?? a.fecha);
    const bDate = toIso(b.fechaInicio ?? b.createdAt ?? b.fecha);
    return aDate.localeCompare(bDate);
  });
}

function periodKey(seed: PeriodSeed): string {
  return `${seed.fechaInicio}|${seed.fechaFin}|${seed.cicloPago}`;
}

function nullableInteger(value: unknown): number | null {
  const parsed = Math.trunc(asNumber(value, Number.NaN));
  return Number.isFinite(parsed) ? parsed : null;
}
