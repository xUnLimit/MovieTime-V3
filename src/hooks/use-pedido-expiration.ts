'use client';

import { useEffect, useState } from 'react';

export function usePedidoExpiration(expiraAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  return Date.parse(expiraAt) <= now;
}
