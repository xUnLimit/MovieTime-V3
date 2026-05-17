'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { useWhatsAppToastStore } from '@/store/whatsappToastStore';

function buildWhatsAppUrl(phone: string, message: string) {
  const base = phone
    ? `https://web.whatsapp.com/send?phone=${phone}&text=`
    : 'https://web.whatsapp.com/send?text=';
  return base + encodeURIComponent(message);
}

export function PendingWhatsAppToast() {
  const pending = useWhatsAppToastStore((state) => state.pending);
  const hydrate = useWhatsAppToastStore((state) => state.hydrate);
  const clearPending = useWhatsAppToastStore((state) => state.clearPending);
  const activeToastRef = useRef<string | number | null>(null);
  const activePendingIdRef = useRef<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!pending) {
      if (activeToastRef.current !== null) {
        toast.dismiss(activeToastRef.current);
      }
      activeToastRef.current = null;
      activePendingIdRef.current = null;
      return;
    }

    if (activePendingIdRef.current === pending.id) return;

    if (activeToastRef.current !== null) {
      toast.dismiss(activeToastRef.current);
    }

    activePendingIdRef.current = pending.id;
    activeToastRef.current = toast.success(pending.title, {
      description: pending.description,
      duration: Infinity,
      action: {
        label: 'Enviar WhatsApp',
        onClick: () => {
          window.open(
            buildWhatsAppUrl(pending.phone, pending.message),
            '_blank',
            'noopener,noreferrer'
          );
          clearPending(pending.id);
        },
      },
      cancel: {
        label: 'Descartar',
        onClick: () => clearPending(pending.id),
      },
      onDismiss: () => clearPending(pending.id),
    });
  }, [clearPending, pending]);

  return null;
}
