import { queryPagosVenta } from '@/lib/supabase/ventas-repository';
import type { PagoVenta, VentaDoc } from '@/types';

export interface VentaConUltimoPago extends VentaDoc {
  precio: number;
  descuento: number;
  precioFinal: number;
  metodoPagoId?: string;
  metodoPagoNombre: string;
  moneda: string;
  renovaciones: number;
}

export async function getVentaConUltimoPagoUseCase(
  venta: VentaDoc,
  pagos?: PagoVenta[],
): Promise<VentaConUltimoPago> {
  const pagosList = pagos ?? await queryPagosVenta<PagoVenta>([
    { field: 'ventaId', operator: '==', value: venta.id },
  ]);
  const pagosRegistrados = pagosList.filter((pago) => pago.estado !== 'reembolsado' && pago.estado !== 'anulado');
  const sorted = [...pagosRegistrados].sort((a, b) => {
    const dateA = a.fechaVencimiento
      ? (a.fechaVencimiento instanceof Date ? a.fechaVencimiento : new Date(a.fechaVencimiento))
      : new Date(0);
    const dateB = b.fechaVencimiento
      ? (b.fechaVencimiento instanceof Date ? b.fechaVencimiento : new Date(b.fechaVencimiento))
      : new Date(0);
    return dateB.getTime() - dateA.getTime();
  });
  const pagoMasReciente = sorted[0];
  const renovaciones = pagosRegistrados.filter((pago) => pago.isPagoInicial === false).length;

  if (!pagoMasReciente) {
    return {
      ...venta,
      precio: 0,
      descuento: 0,
      precioFinal: 0,
      metodoPagoId: undefined,
      metodoPagoNombre: '',
      moneda: 'USD',
      renovaciones: 0,
      cicloPago: venta.cicloPago || 'mensual',
      fechaInicio: venta.fechaInicio || new Date(),
      fechaFin: venta.fechaFin || new Date(),
    };
  }

  return {
    ...venta,
    precio: pagoMasReciente.precio ?? pagoMasReciente.monto,
    descuento: pagoMasReciente.descuento ?? 0,
    precioFinal: pagoMasReciente.monto,
    metodoPagoId: pagoMasReciente.metodoPagoId,
    metodoPagoNombre: pagoMasReciente.metodoPago,
    moneda: pagoMasReciente.moneda ?? 'USD',
    renovaciones,
    cicloPago: pagoMasReciente.cicloPago || 'mensual',
    fechaInicio: pagoMasReciente.fechaInicio ?? new Date(),
    fechaFin: pagoMasReciente.fechaVencimiento ?? new Date(),
  };
}

export async function getVentasConUltimoPagoUseCase(
  ventas: VentaDoc[],
): Promise<VentaConUltimoPago[]> {
  if (ventas.length === 0) return [];

  const ventaIds = ventas.map((venta) => venta.id);
  const chunks: string[][] = [];
  for (let i = 0; i < ventaIds.length; i += 10) {
    chunks.push(ventaIds.slice(i, i + 10));
  }
  const allPagos = await Promise.all(
    chunks.map((chunk) =>
      queryPagosVenta<PagoVenta>([
        { field: 'ventaId', operator: 'in', value: chunk },
      ]),
    ),
  );
  const pagosPorVenta = new Map<string, PagoVenta[]>();
  allPagos.flat().forEach((pago) => {
    const existing = pagosPorVenta.get(pago.ventaId) ?? [];
    pagosPorVenta.set(pago.ventaId, [...existing, pago]);
  });

  return Promise.all(
    ventas.map((venta) => getVentaConUltimoPagoUseCase(venta, pagosPorVenta.get(venta.id) ?? [])),
  );
}
