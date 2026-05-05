/**
 * Payment method changes are not propagated to historical rows in Supabase V2.
 *
 * Payments keep `metodo_pago_nombre_snapshot` so old history remains stable.
 * Current method labels are read through views from the latest registered
 * payment when needed.
 */
export async function syncMetodoPagoDependencias(_params: {
  id: string;
  nombre?: string;
  moneda?: string;
  nombreAnterior?: string;
  monedaAnterior?: string;
}) {
  void _params;
}
