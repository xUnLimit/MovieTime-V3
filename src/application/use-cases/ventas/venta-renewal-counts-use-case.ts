import { readVentaRenewalCounts } from '@/platform/supabase/venta-renewal-counts-repository';

export async function getVentaRenewalCountsUseCase(ventaIds: string[]): Promise<Record<string, number>> {
  if (ventaIds.length === 0) return {};
  const rows = await readVentaRenewalCounts(ventaIds);
  return Object.fromEntries(rows.flatMap(row =>
    row.id && row.renovaciones !== null ? [[row.id, row.renovaciones]] : [],
  ));
}
