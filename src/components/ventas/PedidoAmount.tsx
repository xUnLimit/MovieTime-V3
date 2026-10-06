/** Monto de un pedido: símbolo de moneda en verde y cifra normal (medida estándar de las tablas). */
export function PedidoAmount({ value, currency }: { value: number; currency: string }) {
  return <span className="whitespace-nowrap font-medium tabular-nums"><span className="text-success">{currency === 'USD' ? '$' : `${currency} `}</span>{value.toFixed(2)}</span>;
}
