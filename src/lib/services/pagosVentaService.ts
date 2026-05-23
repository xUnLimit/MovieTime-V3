export {
  createInitialVentaPayment as crearPagoInicial,
  createRenewalVentaPayment as crearPagoRenovacion,
  getVentaPayments as obtenerPagosDeVenta,
  countVentaRenewals as contarRenovacionesDeVenta,
  getManyVentaPayments as obtenerPagosDeVariasVentas,
} from '@/lib/payments';
