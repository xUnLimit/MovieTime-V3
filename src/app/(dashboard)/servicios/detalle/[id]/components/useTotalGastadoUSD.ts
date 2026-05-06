import { useEffect, useState } from 'react';

import { sumInUSD } from '@/lib/utils/calculations';
import type { PagoServicio } from '@/types';

export function useTotalGastadoUSD(pagosServicio: PagoServicio[]) {
  const [totalGastadoUSD, setTotalGastadoUSD] = useState<number>(0);
  const [isCalculatingTotal, setIsCalculatingTotal] = useState(false);

  useEffect(() => {
    const calculateTotal = async () => {
      setIsCalculatingTotal(true);
      try {
        const total = await sumInUSD(
          pagosServicio.map((p) => ({ monto: p.monto, moneda: p.moneda || 'USD' }))
        );
        setTotalGastadoUSD(total);
      } catch (error) {
        console.error('[ServicioDetail] Error calculating total:', error);
        setTotalGastadoUSD(0);
      } finally {
        setIsCalculatingTotal(false);
      }
    };
    calculateTotal();
  }, [pagosServicio]);

  return { isCalculatingTotal, totalGastadoUSD };
}
