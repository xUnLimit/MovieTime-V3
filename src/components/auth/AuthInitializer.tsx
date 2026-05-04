'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';

export function AuthInitializer() {
  const initAuth = useAuthStore((state) => state.initAuth);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    initAuth();
  }, [initAuth]);

  return null;
}

