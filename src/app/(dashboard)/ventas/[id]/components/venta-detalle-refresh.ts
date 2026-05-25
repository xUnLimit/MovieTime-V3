'use client';

import { getVentaConPagoActualUseCase } from '@/lib/use-cases/ventas/ventas-shared';
import type { VentaDoc } from '@/types';

export async function refreshVentaDetalleData(
  ventaId: string,
  setVentaData: (nextVenta: VentaDoc | null) => void,
) {
  if (!ventaId) return;

  const ventaActualizada = await getVentaConPagoActualUseCase(ventaId);
  if (ventaActualizada) setVentaData(ventaActualizada);
}
