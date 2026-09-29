'use client';

import { useEffect, type ReactNode } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

import DashboardLayout from '@/app/(dashboard)/layout';
import { queryKeys } from '@/platform/query-keys';
import { useAuthStore } from '@/store/authStore';

const DEMO_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'admin@movietime.pa',
  displayName: 'Admin Demo',
  role: 'admin' as const,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function demoConversation(waId: string, name: string, unreadCount: number) {
  const now = new Date().toISOString();
  return {
    waId, contactName: name, terceroId: null, terceroNombre: null,
    lastDirection: 'inbound' as const, lastPreview: `Hola de ${name}`, lastMessageAt: now,
    lastInboundAt: now, unreadCount, nextExpiry: null, activeCategories: [],
  };
}

function applyDemoSession() {
  if (useAuthStore.getState().user) return;
  useAuthStore.setState({ user: DEMO_USER, isAuthenticated: true, isHydrated: true, authRecoveryError: null });
}

interface ShellPreviewProps {
  children: ReactNode;
  /** Siembra el cache de React Query con datos sinteticos de la pantalla a revisar. */
  seed?: (queryClient: QueryClient) => void;
}

/** Monta el layout real del dashboard con una sesion sintetica; nunca toca Supabase. */
export function ShellPreview({ children, seed }: ShellPreviewProps) {
  const queryClient = useQueryClient();
  const ready = useAuthStore((state) => state.user !== null);

  useEffect(() => {
    applyDemoSession();
    queryClient.setQueryData(queryKeys.whatsapp.conversations(), [
      demoConversation('50760000001', 'Ana', 2),
      demoConversation('50760000002', 'Luis', 1),
    ]);
    seed?.(queryClient);
    const unsubscribe = useAuthStore.subscribe(applyDemoSession);
    return unsubscribe;
  }, [queryClient, seed]);

  if (!ready) return null;

  return <DashboardLayout>{children}</DashboardLayout>;
}
