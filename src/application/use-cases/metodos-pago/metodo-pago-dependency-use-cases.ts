/**
 * Metodo de pago changes are intentionally not propagated to historical rows.
 * Payments keep snapshots for auditability; current labels are resolved by read
 * models where needed.
 */
export async function syncMetodoPagoDependenciasUseCase(_params: {
  id: string;
  nombre?: string;
  moneda?: string;
  nombreAnterior?: string;
  monedaAnterior?: string;
}) {
  void _params;
}
