import { VentaDoc, PagoVenta } from '@/types';
import { calcularMontoSinConsumir, sumInUSD, convertToUSD } from '@/lib/utils/calculations';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

export interface VentasMetrics {
  ventasTotales: number;
  ingresoTotal: number;
  ingresoMensualEsperado: number;
  montoSinConsumir: number;
  ventasActivas: number;
  ventasInactivas: number;
}

/**
 * Calculate metrics for ventas with multi-currency support
 * All monetary totals are converted to USD for accurate aggregation
 * @param ventas - Array of VentaDoc records (con datos del último pago)
 * @param pagosVentas - Array of PagoVenta records (all payments including renewals)
 * @returns Calculated metrics (monetary values in USD)
 */
export async function calculateVentasMetrics(
  ventas: VentaDoc[],
  pagosVentas: PagoVenta[] = []
): Promise<VentasMetrics> {
  const ventasTotales = ventas.length;

  // Ingreso Total: suma TODOS los pagos recibidos (inicial + renovaciones)
  // Convertir cada pago a USD antes de sumar
  const ingresoTotal = await sumInUSD(
    pagosVentas.map(p => ({ monto: p.monto || 0, moneda: p.moneda }))
  );

  const activas = ventas.filter((v) => v.estado !== 'inactivo');

  // Ingreso Mensual Esperado: suma de ventas que vencen en el mes actual
  const hoy = new Date();
  const inicioMesActual = startOfMonth(hoy);
  const finMesActual = endOfMonth(hoy);

  // Filtrar ventas que vencen en el mes actual
  const ventasVencenMesActual = activas.filter(v => {
    if (!v.fechaFin) return false;
    const fechaVencimiento = new Date(v.fechaFin);
    return isWithinInterval(fechaVencimiento, {
      start: inicioMesActual,
      end: finMesActual,
    });
  });

  // Convertir precioFinal de cada venta a USD y sumar
  const ingresoMensualEsperado = await sumInUSD(
    ventasVencenMesActual.map(v => ({
      monto: v.precioFinal || 0,
      moneda: v.moneda
    }))
  );

  // Calcular monto sin consumir por venta en su moneda original, luego convertir a USD
  const montosRestantes = await Promise.all(
    activas
      .filter(v => v.fechaInicio && v.fechaFin)
      .map(async v => {
        const montoRestanteOriginal = calcularMontoSinConsumir(
          new Date(v.fechaInicio!),
          new Date(v.fechaFin!),
          v.precioFinal || 0
        );
        // Convertir el monto restante a USD
        return await convertToUSD(montoRestanteOriginal, v.moneda || 'USD');
      })
  );
  const montoSinConsumir = montosRestantes.reduce((sum, m) => sum + m, 0);

  return {
    ventasTotales,
    ingresoTotal,
    ingresoMensualEsperado,
    montoSinConsumir,
    ventasActivas: activas.length,
    ventasInactivas: ventas.filter((v) => v.estado === 'inactivo').length,
  };
}
