import { supabase } from './client';
import { toCamelCase } from './mappers';
import { reviveDates } from './dates';
import { ENTITIES, type CollectionName } from './entities';

export function mapReadRow<T>(collectionName: CollectionName, row: unknown): T {
  const camel = reviveDates(toCamelCase<Record<string, unknown>>(row));

  if (collectionName === ENTITIES.SERVICIOS) {
    return {
      ...camel,
      tipo: camel.tipo ?? camel.planTipoId ?? '',
      tipoNombre: camel.tipoNombre ?? camel.planTipoNombre,
      costoServicio: Number(camel.costoServicio ?? camel.ultimoCostoOriginal ?? 0),
      gastosTotal: Number(camel.gastosTotal ?? 0),
      metodoPagoId: camel.metodoPagoId ?? camel.ultimoMetodoPagoId,
      metodoPagoNombre: camel.metodoPagoNombre ?? camel.ultimoMetodoPagoNombre,
      moneda: camel.moneda ?? camel.ultimaMoneda ?? 'USD',
      cicloPago: camel.cicloPago ?? camel.ultimoCicloPago,
      fechaInicio: camel.fechaInicio ?? camel.ultimaFechaInicio,
      fechaVencimiento: camel.fechaVencimiento ?? camel.ultimaFechaVencimiento,
      renovacionAutomatica: Boolean(camel.renovacionAutomatica ?? camel.ultimaRenovacionAutomatica ?? false),
    } as T;
  }

  if (collectionName === ENTITIES.VENTAS) {
    return {
      ...camel,
      fechaInicio: camel.fechaInicio ?? camel.ultimaFechaInicio,
      fechaFin: camel.fechaFin ?? camel.ultimaFechaFin,
      cicloPago: camel.cicloPago ?? camel.ultimoCicloPago,
      precio: Number(camel.precio ?? camel.ultimoPrecioOriginal ?? camel.ultimoTotalOriginal ?? 0),
      precioFinal: Number(camel.precioFinal ?? camel.ultimoTotalOriginal ?? 0),
      descuento: Number(camel.descuento ?? camel.ultimoDescuento ?? 0),
      metodoPagoId: camel.metodoPagoId ?? camel.ultimoMetodoPagoId,
      metodoPagoNombre: camel.metodoPagoNombre ?? camel.ultimoMetodoPagoNombre,
      moneda: camel.moneda ?? camel.ultimaMoneda ?? 'USD',
    } as T;
  }

  if (collectionName === ENTITIES.PAGOS_SERVICIO) {
    const numeroPeriodo = Number(camel.numeroPeriodo ?? 1);
    return {
      ...camel,
      fecha: camel.fecha ?? camel.fechaPago,
      descripcion: camel.descripcion ?? (numeroPeriodo <= 1 ? 'Pago inicial' : `Renovacion #${numeroPeriodo - 1}`),
      monto: Number(camel.monto ?? camel.montoOriginal ?? 0),
      moneda: camel.moneda ?? camel.monedaOriginal ?? 'USD',
      metodoPagoNombre: camel.metodoPagoNombre ?? camel.metodoPagoNombreSnapshot,
      cicloPago: camel.cicloPago ?? camel.periodoCicloPago,
      fechaInicio: camel.fechaInicio ?? camel.periodoInicio,
      fechaVencimiento: camel.fechaVencimiento ?? camel.periodoVencimiento,
      isPagoInicial: camel.isPagoInicial ?? numeroPeriodo === 1,
    } as T;
  }

  if (collectionName === ENTITIES.PAGOS_VENTA) {
    return {
      ...camel,
      fecha: camel.fecha ?? camel.fechaPago,
      monto: Number(camel.monto ?? camel.montoOriginal ?? 0),
      precio: Number(camel.precio ?? camel.precioOriginal ?? camel.montoOriginal ?? 0),
      descuento: Number(camel.descuento ?? 0),
      moneda: camel.moneda ?? camel.monedaOriginal ?? 'USD',
      metodoPago: camel.metodoPago ?? camel.metodoPagoNombreSnapshot ?? '',
      cicloPago: camel.cicloPago ?? camel.periodoCicloPago,
      fechaInicio: camel.fechaInicio ?? camel.periodoInicio,
      fechaVencimiento: camel.fechaVencimiento ?? camel.periodoFin,
      isPagoInicial: camel.isPagoInicial ?? camel.numeroPeriodo === 1,
    } as T;
  }

  if (collectionName === ENTITIES.GASTOS) {
    return {
      ...camel,
      monto: Number(camel.monto ?? camel.montoOriginal ?? 0),
    } as T;
  }

  return camel as T;
}

export async function enrichUsuarios<T>(usuarios: T[]): Promise<T[]> {
  const ids = usuarios
    .map((usuario) => (usuario as Record<string, unknown>).id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (ids.length === 0) return usuarios;
  const metodoIds = usuarios
    .map((usuario) => (usuario as Record<string, unknown>).metodoPagoId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const [metodosResult, serviciosResult] = await Promise.all([
    metodoIds.length > 0
      ? supabase.from('metodos_pago').select('id,nombre,moneda').in('id', metodoIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('v_usuarios_servicios_activos')
      .select('usuario_id,servicios_activos')
      .in('usuario_id', ids),
  ]);

  if (metodosResult.error) throw new Error(metodosResult.error.message);
  if (serviciosResult.error) throw new Error(serviciosResult.error.message);

  const metodos = new Map(
    (metodosResult.data ?? []).map((metodo) => [
      metodo.id,
      { nombre: metodo.nombre, moneda: metodo.moneda },
    ])
  );
  const serviciosActivos = new Map(
    (serviciosResult.data ?? []).map((row) => [
      row.usuario_id,
      Number(row.servicios_activos ?? 0),
    ])
  );

  return usuarios.map((usuario) => {
    const record = usuario as Record<string, unknown>;
    const metodoPagoId = typeof record.metodoPagoId === 'string' ? record.metodoPagoId : undefined;
    const metodo = metodoPagoId ? metodos.get(metodoPagoId) : undefined;
    return {
      ...record,
      metodoPagoNombre: metodo?.nombre ?? record.metodoPagoNombre ?? 'Pendiente',
      moneda: metodo?.moneda ?? record.moneda ?? 'USD',
      serviciosActivos: serviciosActivos.get(String(record.id)) ?? 0,
    } as T;
  });
}

export async function enrichCategorias<T>(categorias: T[]): Promise<T[]> {
  const ids = categorias
    .map((categoria) => (categoria as Record<string, unknown>).id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (ids.length === 0) return categorias;

  const [
    tiposResult,
    planesResult,
    countersResult,
    ventasResult,
    financialResult,
  ] = await Promise.all([
    supabase.from('planes_tipos').select('*').in('categoria_id', ids),
    supabase.from('planes').select('*').in('categoria_id', ids),
    supabase.from('v_categoria_counters').select('*').in('categoria_id', ids),
    supabase.from('v_ventas_full').select('categoria_id,estado').in('categoria_id', ids),
    supabase.from('v_categoria_financial_metrics').select('*').in('categoria_id', ids),
  ]);

  if (tiposResult.error) throw new Error(tiposResult.error.message);
  if (planesResult.error) throw new Error(planesResult.error.message);
  if (countersResult.error) throw new Error(countersResult.error.message);
  if (ventasResult.error) throw new Error(ventasResult.error.message);
  if (financialResult.error) throw new Error(financialResult.error.message);

  const tiposByCategoria = new Map<string, { id: string; nombre: string }[]>();
  for (const tipo of tiposResult.data ?? []) {
    tiposByCategoria.set(tipo.categoria_id, [
      ...(tiposByCategoria.get(tipo.categoria_id) ?? []),
      { id: tipo.id, nombre: tipo.nombre },
    ]);
  }

  const planesByCategoria = new Map<string, {
    id: string;
    nombre: string;
    precio: number;
    cicloPago: string;
    tipoPlan: string;
  }[]>();
  for (const plan of planesResult.data ?? []) {
    planesByCategoria.set(plan.categoria_id, [
      ...(planesByCategoria.get(plan.categoria_id) ?? []),
      {
        id: plan.id,
        nombre: plan.nombre,
        precio: Number(plan.precio),
        cicloPago: plan.ciclo_pago,
        tipoPlan: plan.plan_tipo_id,
      },
    ]);
  }

  const countersByCategoria = new Map(
    (countersResult.data ?? []).map((counter) => [counter.categoria_id, counter])
  );
  const ventasActivasByCategoria = new Map<string, number>();
  for (const venta of ventasResult.data ?? []) {
    if (!venta.categoria_id || venta.estado === 'inactivo') continue;
    ventasActivasByCategoria.set(
      venta.categoria_id,
      (ventasActivasByCategoria.get(venta.categoria_id) ?? 0) + 1
    );
  }
  const financialByCategoria = new Map(
    (financialResult.data ?? []).map((row) => [row.categoria_id, row])
  );

  return categorias.map((categoria) => {
    const record = categoria as Record<string, unknown>;
    const id = String(record.id);
    const counters = countersByCategoria.get(id);
    const financial = financialByCategoria.get(id);
    return {
      ...record,
      tiposPlanes: tiposByCategoria.get(id) ?? [],
      planes: planesByCategoria.get(id) ?? [],
      totalServicios: Number(counters?.total_servicios ?? record.totalServicios ?? 0),
      serviciosActivos: Number(counters?.servicios_activos ?? record.serviciosActivos ?? 0),
      perfilesDisponiblesTotal: Number(
        counters?.perfiles_disponibles_total ?? record.perfilesDisponiblesTotal ?? 0
      ),
      ventasTotales: ventasActivasByCategoria.get(id) ?? Number(record.ventasTotales ?? 0),
      ingresosTotales: Number(financial?.ingresos_usd ?? record.ingresosTotales ?? 0),
      gastosTotal: Number(financial?.gastos_usd ?? record.gastosTotal ?? 0),
    } as T;
  });
}
