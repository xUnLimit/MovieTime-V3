import { doc, getDoc, setDoc, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { currencyService } from '@/lib/services/currencyService';
import { format } from 'date-fns';
import type { DashboardStats, UsuariosMes, IngresosMes, IngresoCategoria, IngresoCategoriaMes, IngresosDia, UsuariosDia, VentaPronostico, ServicioPronostico } from '@/types/dashboard';
import type { VentaDoc, PagoVenta } from '@/types/ventas';
import type { Servicio, PagoServicio } from '@/types/servicios';
import type { Usuario } from '@/types/clientes';
import type { Gasto } from '@/types/gastos';

const STATS_DOC_ID = 'dashboard_stats';
const CONFIG_COLLECTION = 'config';

function createEmptyStats(): DashboardStats {
  return {
    gastosTotal: 0,
    ingresosTotal: 0,
    usuariosPorMes: [],
    usuariosPorDia: [],
    ingresosPorMes: [],
    ingresosPorDia: [],
    ingresosPorCategoria: [],
    ingresosCategoriasPorMes: [],
    ventasPronostico: [],
    serviciosPronostico: [],
  };
}

// ===========================
// READ (with one-time seed for pronostico arrays)
// ===========================

export async function getDashboardStats(): Promise<DashboardStats> {
  const docRef = doc(db, CONFIG_COLLECTION, STATS_DOC_ID);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return createEmptyStats();

  let data = snap.data();

  // One-time seed: if pronostico arrays don't exist yet, populate from existing data
  const needsVentas = data.ventasPronostico === undefined;
  const needsServicios = data.serviciosPronostico === undefined;

  if (needsVentas || needsServicios) {
    const seedUpdates: Record<string, unknown> = {};

    try {
      const { getAll, COLLECTIONS } = await import('@/lib/firebase/firestore');

      if (needsVentas) {
        const ventas = await getAll<VentaDoc>(COLLECTIONS.VENTAS);
        seedUpdates.ventasPronostico = ventas
          .filter((v) => v.estado !== 'inactivo' && v.fechaFin && v.cicloPago)
          .map((v) => ({
            id: v.id,
            categoriaId: v.categoriaId ?? '',
            fechaInicio: v.fechaInicio instanceof Date ? format(v.fechaInicio, "yyyy-MM-dd'T'HH:mm:ss") : String(v.fechaInicio ?? new Date()),
            fechaFin: v.fechaFin instanceof Date ? format(v.fechaFin, "yyyy-MM-dd'T'HH:mm:ss") : String(v.fechaFin),
            cicloPago: v.cicloPago as string,
            precioFinal: v.precio || v.precioFinal || 0,
            moneda: v.moneda || 'USD',
          }));
      }

      if (needsServicios) {
        const servicios = await getAll<Servicio>(COLLECTIONS.SERVICIOS);
        seedUpdates.serviciosPronostico = servicios
          .filter((s) => s.activo && s.fechaVencimiento && s.cicloPago && s.costoServicio > 0)
          .map((s) => ({
            id: s.id,
            fechaVencimiento: s.fechaVencimiento instanceof Date
              ? format(s.fechaVencimiento, "yyyy-MM-dd'T'HH:mm:ss")
              : String(s.fechaVencimiento),
            cicloPago: s.cicloPago as string,
            costoServicio: s.costoServicio,
            moneda: s.moneda || 'USD',
          }));
      }

      // Save to Firestore so this never runs again
      await setDoc(docRef, { ...seedUpdates, updatedAt: Timestamp.now() }, { merge: true });

      // Merge into local data so we return it immediately
      data = { ...data, ...seedUpdates };
    } catch (err) {
      console.error('[DashboardStats] Seed failed:', err);
    }
  }

  return {
    gastosTotal: data.gastosTotal ?? 0,
    ingresosTotal: data.ingresosTotal ?? 0,
    usuariosPorMes: data.usuariosPorMes ?? [],
    usuariosPorDia: data.usuariosPorDia ?? [],
    ingresosPorMes: data.ingresosPorMes ?? [],
    ingresosPorDia: data.ingresosPorDia ?? [],
    ingresosPorCategoria: data.ingresosPorCategoria ?? [],
    ingresosCategoriasPorMes: data.ingresosCategoriasPorMes ?? [],
    pronostico: data.pronostico ?? undefined,
    ventasPronostico: data.ventasPronostico ?? [],
    serviciosPronostico: data.serviciosPronostico ?? [],
    updatedAt: data.updatedAt?.toDate?.() ?? undefined,
  };
}

// ===========================
// HELPERS
// ===========================

function getMesKey(date: Date): string {
  return format(date, 'yyyy-MM');
}

function getDiaKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function getCurrentMesKey(): string {
  return getMesKey(new Date());
}

/** Resetea ingresosPorDia si el mes cambió, y mantiene solo el mes actual */
function resetDiaIfNewMonth<T extends { dia: string }>(arr: T[], currentMes: string): T[] {
  return arr.filter((d) => d.dia.startsWith(currentMes));
}


/**
 * Parse raw Firestore data into a full DashboardStats object.
 * Used inside transactions where we can't call getOrCreate().
 */
function parseStatsFromData(data: Record<string, unknown>): DashboardStats {
  return {
    gastosTotal: (data.gastosTotal as number) ?? 0,
    ingresosTotal: (data.ingresosTotal as number) ?? 0,
    usuariosPorMes: (data.usuariosPorMes as UsuariosMes[]) ?? [],
    usuariosPorDia: (data.usuariosPorDia as UsuariosDia[]) ?? [],
    ingresosPorMes: (data.ingresosPorMes as IngresosMes[]) ?? [],
    ingresosPorDia: (data.ingresosPorDia as IngresosDia[]) ?? [],
    ingresosPorCategoria: (data.ingresosPorCategoria as IngresoCategoria[]) ?? [],
    ingresosCategoriasPorMes: (data.ingresosCategoriasPorMes as IngresoCategoriaMes[]) ?? [],
    ventasPronostico: (data.ventasPronostico as VentaPronostico[]) ?? [],
    serviciosPronostico: (data.serviciosPronostico as ServicioPronostico[]) ?? [],
  };
}

// ===========================
// INGRESOS (called by ventasStore) — uses Firestore transaction
// ===========================

export async function adjustIngresosStats(params: {
  delta: number;
  moneda: string;
  mes: string; // "YYYY-MM"
  dia: string; // "YYYY-MM-DD"
  categoriaId: string;
  categoriaNombre: string;
}): Promise<void> {
  try {
    const { delta, moneda, mes, dia, categoriaId, categoriaNombre } = params;
    const deltaUSD = await currencyService.convertToUSD(Math.abs(delta), moneda);
    const signedDelta = delta < 0 ? -deltaUSD : deltaUSD;

    const docRef = doc(db, CONFIG_COLLECTION, STATS_DOC_ID);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      const stats = snap.exists()
        ? parseStatsFromData(snap.data())
        : createEmptyStats();

      // Update ingresosTotal
      stats.ingresosTotal = Math.max(0, stats.ingresosTotal + signedDelta);

      // Update ingresosPorMes
      const mesEntry = stats.ingresosPorMes.find((m) => m.mes === mes);
      if (mesEntry) {
        mesEntry.ingresos = Math.max(0, mesEntry.ingresos + signedDelta);
      } else {
        stats.ingresosPorMes.push({ mes, ingresos: Math.max(0, signedDelta), gastos: 0 });
      }

      // Update ingresosPorDia (solo mes actual)
      const currentMes = getCurrentMesKey();
      stats.ingresosPorDia = resetDiaIfNewMonth(stats.ingresosPorDia, currentMes);
      if (mes === currentMes) {
        const diaEntry = stats.ingresosPorDia.find((d) => d.dia === dia);
        if (diaEntry) {
          diaEntry.ingresos = Math.max(0, diaEntry.ingresos + signedDelta);
        } else {
          stats.ingresosPorDia.push({ dia, ingresos: Math.max(0, signedDelta), gastos: 0 });
        }
      }

      // Update ingresosPorCategoria
      const catEntry = stats.ingresosPorCategoria.find((c) => c.categoriaId === categoriaId);
      if (catEntry) {
        catEntry.total = Math.max(0, catEntry.total + signedDelta);
      } else {
        stats.ingresosPorCategoria.push({
          categoriaId,
          nombre: categoriaNombre,
          total: Math.max(0, signedDelta),
        });
      }

      // Update ingresosCategoriasPorMes (for year filter)
      if (!stats.ingresosCategoriasPorMes) stats.ingresosCategoriasPorMes = [];
      const catMesEntry = stats.ingresosCategoriasPorMes.find(
        (c) => c.categoriaId === categoriaId && c.mes === mes
      );
      if (catMesEntry) {
        catMesEntry.total = Math.max(0, catMesEntry.total + signedDelta);
      } else {
        stats.ingresosCategoriasPorMes.push({
          mes,
          categoriaId,
          nombre: categoriaNombre,
          total: Math.max(0, signedDelta),
          gastos: 0,
        });
      }

      transaction.set(docRef, { ...stats, updatedAt: Timestamp.now() }, { merge: true });
    });
  } catch (error) {
    console.error('[DashboardStats] Error adjusting ingresos:', error);
  }
}

// ===========================
// GASTOS (called by serviciosStore) — uses Firestore transaction
// ===========================

export async function adjustGastosStats(params: {
  delta: number;
  moneda: string;
  mes: string; // "YYYY-MM"
  dia: string; // "YYYY-MM-DD"
  categoriaId?: string;
  categoriaNombre?: string;
}): Promise<void> {
  try {
    const { delta, moneda, mes, dia, categoriaId, categoriaNombre } = params;
    const deltaUSD = await currencyService.convertToUSD(Math.abs(delta), moneda);
    const signedDelta = delta < 0 ? -deltaUSD : deltaUSD;

    const docRef = doc(db, CONFIG_COLLECTION, STATS_DOC_ID);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      const stats = snap.exists()
        ? parseStatsFromData(snap.data())
        : createEmptyStats();

      // Update gastosTotal
      stats.gastosTotal = Math.max(0, stats.gastosTotal + signedDelta);

      // Update ingresosPorMes gastos field
      const mesEntry = stats.ingresosPorMes.find((m) => m.mes === mes);
      if (mesEntry) {
        mesEntry.gastos = Math.max(0, mesEntry.gastos + signedDelta);
      } else {
        stats.ingresosPorMes.push({ mes, ingresos: 0, gastos: Math.max(0, signedDelta) });
      }

      // Update ingresosPorDia gastos field (solo mes actual)
      const currentMes = getCurrentMesKey();
      stats.ingresosPorDia = resetDiaIfNewMonth(stats.ingresosPorDia, currentMes);
      if (mes === currentMes) {
        const diaEntry = stats.ingresosPorDia.find((d) => d.dia === dia);
        if (diaEntry) {
          diaEntry.gastos = Math.max(0, diaEntry.gastos + signedDelta);
        } else {
          stats.ingresosPorDia.push({ dia, ingresos: 0, gastos: Math.max(0, signedDelta) });
        }
      }

      // Update gastos por categoría
      if (categoriaId) {
        const catEntry = stats.ingresosPorCategoria.find((c) => c.categoriaId === categoriaId);
        if (catEntry) {
          catEntry.gastos = Math.max(0, (catEntry.gastos ?? 0) + signedDelta);
        } else {
          stats.ingresosPorCategoria.push({
            categoriaId,
            nombre: categoriaNombre ?? categoriaId,
            total: 0,
            gastos: Math.max(0, signedDelta),
          });
        }

        // Update ingresosCategoriasPorMes gastos (for year filter)
        if (!stats.ingresosCategoriasPorMes) stats.ingresosCategoriasPorMes = [];
        const catMesEntry = stats.ingresosCategoriasPorMes.find(
          (c) => c.categoriaId === categoriaId && c.mes === mes
        );
        if (catMesEntry) {
          catMesEntry.gastos = Math.max(0, catMesEntry.gastos + signedDelta);
        } else {
          stats.ingresosCategoriasPorMes.push({
            mes,
            categoriaId,
            nombre: categoriaNombre ?? categoriaId,
            total: 0,
            gastos: Math.max(0, signedDelta),
          });
        }
      }

      transaction.set(docRef, { ...stats, updatedAt: Timestamp.now() }, { merge: true });
    });
  } catch (error) {
    console.error('[DashboardStats] Error adjusting gastos:', error);
    throw error;
  }
}

// ===========================
// USUARIOS (called by usuariosStore) — uses Firestore transaction
// ===========================

export async function adjustUsuariosPorMes(params: {
  mes: string; // "YYYY-MM"
  dia: string; // "YYYY-MM-DD"
  tipo: 'cliente' | 'revendedor';
  delta: 1 | -1;
}): Promise<void> {
  try {
    const { mes, dia, tipo, delta } = params;

    const docRef = doc(db, CONFIG_COLLECTION, STATS_DOC_ID);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      const stats = snap.exists()
        ? parseStatsFromData(snap.data())
        : createEmptyStats();

      // Update usuariosPorMes
      const mesEntry = stats.usuariosPorMes.find((m) => m.mes === mes);
      if (mesEntry) {
        if (tipo === 'cliente') {
          mesEntry.clientes = Math.max(0, mesEntry.clientes + delta);
        } else {
          mesEntry.revendedores = Math.max(0, mesEntry.revendedores + delta);
        }
      } else {
        stats.usuariosPorMes.push({
          mes,
          clientes: tipo === 'cliente' ? Math.max(0, delta) : 0,
          revendedores: tipo === 'revendedor' ? Math.max(0, delta) : 0,
        });
      }
      // Update usuariosPorDia (solo mes actual)
      const currentMes = getCurrentMesKey();
      stats.usuariosPorDia = resetDiaIfNewMonth(stats.usuariosPorDia, currentMes);
      if (mes === currentMes) {
        const diaEntry = stats.usuariosPorDia.find((d) => d.dia === dia);
        if (diaEntry) {
          if (tipo === 'cliente') {
            diaEntry.clientes = Math.max(0, diaEntry.clientes + delta);
          } else {
            diaEntry.revendedores = Math.max(0, diaEntry.revendedores + delta);
          }
        } else {
          stats.usuariosPorDia.push({
            dia,
            clientes: tipo === 'cliente' ? Math.max(0, delta) : 0,
            revendedores: tipo === 'revendedor' ? Math.max(0, delta) : 0,
          });
        }
      }

      transaction.set(docRef, { ...stats, updatedAt: Timestamp.now() }, { merge: true });
    });
  } catch (error) {
    console.error('[DashboardStats] Error adjusting usuariosPorMes:', error);
  }
}

// ===========================
// PRONÓSTICO SOURCE DATA — uses Firestore transactions
// Stores minimal denormalized fields needed to compute the forecast client-side.
// No getAll reads needed on dashboard load.
// ===========================

/**
 * Upserts or removes a single venta in the ventasPronostico array.
 * Uses a Firestore transaction to prevent race conditions.
 */
export async function upsertVentaPronostico(venta: VentaPronostico | null, ventaId: string): Promise<void> {
  try {
    const docRef = doc(db, CONFIG_COLLECTION, STATS_DOC_ID);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      const existing: VentaPronostico[] = snap.exists()
        ? (snap.data().ventasPronostico ?? [])
        : [];

      let updated: VentaPronostico[];
      if (venta === null) {
        updated = existing.filter((v) => v.id !== ventaId);
      } else {
        const idx = existing.findIndex((v) => v.id === ventaId);
        updated = idx >= 0
          ? existing.map((v, i) => (i === idx ? venta : v))
          : [...existing, venta];
      }

      transaction.set(docRef, { ventasPronostico: updated, updatedAt: Timestamp.now() }, { merge: true });
    });
  } catch (error) {
    console.error('[DashboardStats] Error upserting ventaPronostico:', error);
  }
}

/**
 * Upserts or removes a single servicio in the serviciosPronostico array.
 * Uses a Firestore transaction to prevent race conditions.
 */
export async function upsertServicioPronostico(servicio: ServicioPronostico | null, servicioId: string): Promise<void> {
  try {
    const docRef = doc(db, CONFIG_COLLECTION, STATS_DOC_ID);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      const existing: ServicioPronostico[] = snap.exists()
        ? (snap.data().serviciosPronostico ?? [])
        : [];

      let updated: ServicioPronostico[];
      if (servicio === null) {
        updated = existing.filter((s) => s.id !== servicioId);
      } else {
        const idx = existing.findIndex((s) => s.id === servicioId);
        updated = idx >= 0
          ? existing.map((s, i) => (i === idx ? servicio : s))
          : [...existing, servicio];
      }

      transaction.set(docRef, { serviciosPronostico: updated, updatedAt: Timestamp.now() }, { merge: true });
    });
  } catch (error) {
    console.error('[DashboardStats] Error upserting servicioPronostico:', error);
  }
}

// ===========================
// FULL REBUILD (recalculates everything from scratch)
// ===========================

/**
 * Reads ALL ventas, pagosVenta, servicios, pagosServicio, gastos, and usuarios from Firestore
 * and rebuilds the dashboard_stats document from scratch.
 *
 * Use this to sync historical data or fix inconsistencies.
 * This is an expensive operation — call only on user demand.
 * 
 * @param preFetchedData - Optional data already loaded from Firestore to avoid redundant reads
 */
export async function rebuildDashboardStats(preFetchedData?: {
  ventas?: VentaDoc[];
  pagosVenta?: PagoVenta[];
  pagosServicio?: PagoServicio[];
  usuarios?: Usuario[];
  servicios?: Servicio[];
  gastosManuales?: Gasto[];
}): Promise<void> {
  const { getAll, COLLECTIONS } = await import('@/lib/firebase/firestore');

  const [ventas, pagosVenta, pagosServicio, usuarios, servicios, gastosManuales] = preFetchedData 
    ? [
        preFetchedData.ventas || await getAll<VentaDoc>(COLLECTIONS.VENTAS),
        preFetchedData.pagosVenta || await getAll<PagoVenta>(COLLECTIONS.PAGOS_VENTA),
        preFetchedData.pagosServicio || await getAll<PagoServicio>(COLLECTIONS.PAGOS_SERVICIO),
        preFetchedData.usuarios || await getAll<Usuario>(COLLECTIONS.USUARIOS),
        preFetchedData.servicios || await getAll<Servicio>(COLLECTIONS.SERVICIOS),
        preFetchedData.gastosManuales || await getAll<Gasto>(COLLECTIONS.GASTOS),
      ]
    : await Promise.all([
        getAll<VentaDoc>(COLLECTIONS.VENTAS),
        getAll<PagoVenta>(COLLECTIONS.PAGOS_VENTA),
        getAll<PagoServicio>(COLLECTIONS.PAGOS_SERVICIO),
        getAll<Usuario>(COLLECTIONS.USUARIOS),
        getAll<Servicio>(COLLECTIONS.SERVICIOS),
        getAll<Gasto>(COLLECTIONS.GASTOS),
      ]);

  // Ensure exchange rates are loaded
  await currencyService.ensureRatesLoaded();

  const stats: DashboardStats = createEmptyStats();

  // Pre-build lookup maps for O(1) access inside loops
  const ventasPorId = new Map(ventas.map((v) => [v.id, v]));

  // ---------- INGRESOS ----------
  const currentMes = getCurrentMesKey();
  for (const pago of pagosVenta) {
    const monto = pago.monto || 0;
    const moneda = pago.moneda || 'USD';
    // Use fechaInicio (period start) for chart placement; fall back to fecha if missing
    const rawFecha = (pago.fechaInicio ?? pago.fecha) as unknown;
    const fecha = rawFecha instanceof Date ? rawFecha : new Date(rawFecha as string);
    if (isNaN(fecha.getTime())) continue;

    const usd = currencyService.convertToUSDSync(monto, moneda);
    const mes = getMesKey(fecha);
    const dia = getDiaKey(fecha);

    stats.ingresosTotal += usd;

    const mesEntry = stats.ingresosPorMes.find((m) => m.mes === mes);
    if (mesEntry) {
      mesEntry.ingresos += usd;
    } else {
      stats.ingresosPorMes.push({ mes, ingresos: usd, gastos: 0 });
    }

    if (mes === currentMes) {
      const diaEntry = stats.ingresosPorDia.find((d) => d.dia === dia);
      if (diaEntry) {
        diaEntry.ingresos += usd;
      } else {
        stats.ingresosPorDia.push({ dia, ingresos: usd, gastos: 0 });
      }
    }

    // ingresosPorCategoria — use categoriaId from pago (denormalized), fall back to venta
    const categoriaId = pago.categoriaId || ventasPorId.get(pago.ventaId)?.categoriaId;
    if (categoriaId) {
      const categoriaNombre = ventasPorId.get(pago.ventaId)?.categoriaNombre || categoriaId;
      const catEntry = stats.ingresosPorCategoria.find((c) => c.categoriaId === categoriaId);
      if (catEntry) {
        catEntry.total += usd;
      } else {
        stats.ingresosPorCategoria.push({ categoriaId, nombre: categoriaNombre, total: usd });
      }

      // ingresosCategoriasPorMes
      const catMesEntry = stats.ingresosCategoriasPorMes!.find(
        (c) => c.categoriaId === categoriaId && c.mes === mes
      );
      if (catMesEntry) {
        catMesEntry.total += usd;
      } else {
        stats.ingresosCategoriasPorMes!.push({ mes, categoriaId, nombre: categoriaNombre, total: usd, gastos: 0 });
      }
    }
  }

  // ---------- GASTOS ----------
  // Build a map of servicioId -> categoriaId from servicios for fallback lookup
  const serviciosCategoriaMap = new Map(servicios.map((s) => [s.id, { categoriaId: s.categoriaId, categoriaNombre: s.categoriaNombre }]));

  for (const pago of pagosServicio) {
    const monto = pago.monto || 0;
    const moneda = pago.moneda || 'USD';
    // Use fechaInicio (period start) for chart placement; fall back to fecha if missing
    const rawFechaGasto = (pago.fechaInicio ?? pago.fecha) as unknown;
    const fecha = rawFechaGasto instanceof Date ? rawFechaGasto : new Date(rawFechaGasto as string);
    if (isNaN(fecha.getTime())) continue;

    const usd = currencyService.convertToUSDSync(monto, moneda);
    const mes = getMesKey(fecha);
    const dia = getDiaKey(fecha);

    stats.gastosTotal += usd;

    const mesEntry = stats.ingresosPorMes.find((m) => m.mes === mes);
    if (mesEntry) {
      mesEntry.gastos += usd;
    } else {
      stats.ingresosPorMes.push({ mes, ingresos: 0, gastos: usd });
    }

    const currentMes = getCurrentMesKey();
    if (mes === currentMes) {
      const diaEntry = stats.ingresosPorDia.find((d) => d.dia === dia);
      if (diaEntry) {
        diaEntry.gastos += usd;
      } else {
        stats.ingresosPorDia.push({ dia, ingresos: 0, gastos: usd });
      }
    }

    // gastos por categoría — categoriaId está denormalizado en PagoServicio
    const categoriaId = pago.categoriaId || serviciosCategoriaMap.get(pago.servicioId)?.categoriaId;
    if (categoriaId) {
      const categoriaNombre = serviciosCategoriaMap.get(pago.servicioId)?.categoriaNombre ?? categoriaId;
      const catEntry = stats.ingresosPorCategoria.find((c) => c.categoriaId === categoriaId);
      if (catEntry) {
        catEntry.gastos = (catEntry.gastos ?? 0) + usd;
      } else {
        stats.ingresosPorCategoria.push({ categoriaId, nombre: categoriaNombre, total: 0, gastos: usd });
      }

      // ingresosCategoriasPorMes gastos
      const catMesEntry = stats.ingresosCategoriasPorMes!.find(
        (c) => c.categoriaId === categoriaId && c.mes === mes
      );
      if (catMesEntry) {
        catMesEntry.gastos += usd;
      } else {
        stats.ingresosCategoriasPorMes!.push({ mes, categoriaId, nombre: categoriaNombre, total: 0, gastos: usd });
      }
    }
  }

  // ---------- GASTOS MANUALES ----------
  for (const gasto of gastosManuales) {
    const fecha = gasto.fecha instanceof Date
      ? gasto.fecha
      : new Date(gasto.fecha as unknown as string);
    if (isNaN(fecha.getTime())) continue;

    const monto = Number(gasto.monto || 0);
    if (monto <= 0) continue;

    const mes = getMesKey(fecha);
    const dia = getDiaKey(fecha);

    stats.gastosTotal += monto;

    const mesEntry = stats.ingresosPorMes.find((m) => m.mes === mes);
    if (mesEntry) {
      mesEntry.gastos += monto;
    } else {
      stats.ingresosPorMes.push({ mes, ingresos: 0, gastos: monto });
    }

    if (mes === currentMes) {
      const diaEntry = stats.ingresosPorDia.find((d) => d.dia === dia);
      if (diaEntry) {
        diaEntry.gastos += monto;
      } else {
        stats.ingresosPorDia.push({ dia, ingresos: 0, gastos: monto });
      }
    }
  }

  // ---------- USUARIOS ----------
  for (const usuario of usuarios) {
    const fecha = usuario.createdAt instanceof Date
      ? usuario.createdAt
      : new Date(usuario.createdAt as unknown as string);
    if (isNaN(fecha.getTime())) continue;

    const mes = getMesKey(fecha);
    const dia = getDiaKey(fecha);
    const tipo = usuario.tipo as 'cliente' | 'revendedor';
    if (tipo !== 'cliente' && tipo !== 'revendedor') continue;

    const mesEntry = stats.usuariosPorMes.find((m) => m.mes === mes);
    if (mesEntry) {
      if (tipo === 'cliente') mesEntry.clientes += 1;
      else mesEntry.revendedores += 1;
    } else {
      stats.usuariosPorMes.push({
        mes,
        clientes: tipo === 'cliente' ? 1 : 0,
        revendedores: tipo === 'revendedor' ? 1 : 0,
      });
    }

    const currentMes = getCurrentMesKey();
    if (mes === currentMes) {
      const diaEntry = stats.usuariosPorDia.find((d) => d.dia === dia);
      if (diaEntry) {
        if (tipo === 'cliente') diaEntry.clientes += 1;
        else diaEntry.revendedores += 1;
      } else {
        stats.usuariosPorDia.push({
          dia,
          clientes: tipo === 'cliente' ? 1 : 0,
          revendedores: tipo === 'revendedor' ? 1 : 0,
        });
      }
    }
  }

  // ---------- PRONÓSTICO ----------
  // Group pagosVenta by ventaId, pick the most recent (highest fechaVencimiento) per venta
  const pagosPorVentaMap = new Map<string, PagoVenta>();
  for (const pago of pagosVenta) {
    const existing = pagosPorVentaMap.get(pago.ventaId);
    const pagoFecha = pago.fechaVencimiento
      ? (pago.fechaVencimiento instanceof Date ? pago.fechaVencimiento : new Date(pago.fechaVencimiento as unknown as string))
      : new Date(0);
    const existingFecha = existing?.fechaVencimiento
      ? (existing.fechaVencimiento instanceof Date ? existing.fechaVencimiento : new Date(existing.fechaVencimiento as unknown as string))
      : new Date(0);
    if (!existing || pagoFecha > existingFecha) {
      pagosPorVentaMap.set(pago.ventaId, pago);
    }
  }

  stats.ventasPronostico = ventas
    .filter((v) => v.estado !== 'inactivo' && v.fechaFin && v.cicloPago)
    .map((v) => {
      const ultimoPago = pagosPorVentaMap.get(v.id!);
      return {
        id: v.id!,
        categoriaId: v.categoriaId ?? '',
        fechaInicio: ultimoPago?.fechaInicio instanceof Date
          ? format(ultimoPago.fechaInicio, "yyyy-MM-dd'T'HH:mm:ss")
          : v.fechaInicio instanceof Date
            ? format(v.fechaInicio, "yyyy-MM-dd'T'HH:mm:ss")
            : String(v.fechaInicio ?? new Date()),
        fechaFin: ultimoPago?.fechaVencimiento instanceof Date
          ? format(ultimoPago.fechaVencimiento, "yyyy-MM-dd'T'HH:mm:ss")
          : v.fechaFin instanceof Date ? format(v.fechaFin, "yyyy-MM-dd'T'HH:mm:ss") : String(v.fechaFin),
        cicloPago: (ultimoPago?.cicloPago || v.cicloPago) as string,
        precioFinal: ultimoPago ? (ultimoPago.precio || ultimoPago.monto || 0) : (v.precio || v.precioFinal || 0),
        moneda: ultimoPago ? (ultimoPago.moneda || 'USD') : (v.moneda || 'USD'),
      };
    });

  stats.serviciosPronostico = servicios
    .filter((s) => s.activo && s.fechaVencimiento && s.cicloPago && s.costoServicio > 0)
    .map((s) => ({
      id: s.id!,
      fechaVencimiento: s.fechaVencimiento instanceof Date
        ? format(s.fechaVencimiento, "yyyy-MM-dd'T'HH:mm:ss")
        : String(s.fechaVencimiento),
      cicloPago: s.cicloPago as string,
      costoServicio: s.costoServicio,
      moneda: s.moneda || 'USD',
    }));

  // Sort chronologically (no month cap — full history is preserved)
  stats.ingresosPorMes = stats.ingresosPorMes.sort((a, b) => a.mes.localeCompare(b.mes));
  stats.usuariosPorMes = stats.usuariosPorMes.sort((a, b) => a.mes.localeCompare(b.mes));

  // ---------- PERSIST dashboard_stats ----------
  const docRef = doc(db, CONFIG_COLLECTION, STATS_DOC_ID);
  await setDoc(docRef, { ...stats, updatedAt: Timestamp.now() });
}

// ===========================
// UTILITIES
// ===========================

export function getMesKeyFromDate(date: Date): string {
  return getMesKey(date);
}

export function getDiaKeyFromDate(date: Date): string {
  return getDiaKey(date);
}
