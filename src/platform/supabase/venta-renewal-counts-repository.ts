import { supabase } from './client';

export async function readVentaRenewalCounts(ventaIds: string[]) {
  const rows: Array<{ id: string | null; renovaciones: number | null }> = [];
  const ids = [...new Set(ventaIds)];
  // Keep each request below the API row limit and avoid oversized URLs.
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await supabase
      .from('v_ventas_full')
      .select('id, renovaciones')
      .in('id', ids.slice(offset, offset + 100));
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
  }
  return rows;
}
