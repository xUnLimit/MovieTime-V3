import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/platform/query-keys';
import { sumInUSD } from '@/lib/payments';
import type { PagoServicio } from '@/types';

export function useTotalGastadoUSD(pagosServicio: PagoServicio[]) {
  const pagosSignature = useMemo(
    () =>
      pagosServicio
        .map((pago) => `${pago.id ?? ''}:${pago.monto}:${pago.moneda ?? 'USD'}`)
        .sort()
        .join('|'),
    [pagosServicio]
  );
  const { data: totalGastadoUSD = 0, isLoading: isCalculatingTotal } = useQuery({
    queryKey: queryKeys.servicios.pagosTotalUsd(pagosSignature),
    queryFn: () =>
      sumInUSD(
        pagosServicio.map((p) => ({ monto: p.monto, moneda: p.moneda || 'USD' }))
      ),
  });

  return { isCalculatingTotal, totalGastadoUSD };
}
