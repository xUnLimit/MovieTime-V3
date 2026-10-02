import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getVentasActivasParaCredenciales } from '@/application/use-cases/servicios/servicio-credential-notification-use-case';
import { useAuthStore } from '@/store/authStore';

export function useCodeAccessNotice(serviceId: string | undefined) {
  const role = useAuthStore(state => state.user?.role);
  const sales = useQuery({ queryKey: ['code-access-customers', serviceId, role],
    queryFn: () => getVentasActivasParaCredenciales(serviceId ?? ''), enabled: !!serviceId && role === 'admin', retry: false });
  const [pending, setPending] = useState<{ enabled: boolean; apply: () => void } | null>(null);
  const send = useRef(false);
  function request(enabled: boolean, apply: () => void) {
    if (role !== 'admin') return;
    if (!serviceId) { apply(); return; }
    if (sales.isLoading || sales.isError) return;
    if (!sales.data?.length) { apply(); return; }
    setPending({ enabled, apply });
  }
  function confirm(notify: boolean) {
    if (!pending) return;
    send.current = notify; pending.apply(); setPending(null);
  }
  return { pending, request, confirm, cancel: () => setPending(null), send, count: sales.data?.length ?? 0,
    loading: !!serviceId && sales.isLoading, error: sales.isError, retry: () => sales.refetch(), allowed: role === 'admin' };
}
