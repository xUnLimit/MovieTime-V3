'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToReportChanges } from '@/application/use-cases/customer-reports-use-cases';
import { safeAsyncSideEffect } from '@/platform/utils/safety';

export function useCustomerReportsRealtime(enabled: boolean): number {
  const client = useQueryClient();
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer !== undefined) return;
      timer = setTimeout(() => {
        timer = undefined;
        safeAsyncSideEffect(client.invalidateQueries({ queryKey: ['customer-reports'] }), { operation: 'refrescar reportes' });
      }, 250);
    };
    const unsubscribe = subscribeToReportChanges({
      onChange: refresh,
      onStatus: status => {
        setLive(status === 'live');
        // Cubre cambios ocurridos antes de suscribirse o durante una desconexion.
        if (status === 'live') refresh();
      },
    });
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      unsubscribe();
    };
  }, [client, enabled]);
  return enabled && live ? 120_000 : 30_000;
}
