import { toast } from 'sonner';

import { sendAutomaticRenewalNoticeUseCase } from '@/application/use-cases/whatsapp-notices-use-cases';
import { offerApiAccessNotice } from '@/components/shared/offer-api-access-notice';
import { openWhatsAppNow } from '@/components/shared/open-whatsapp-now';
import { reportError } from '@/platform/observability/logger';
import type { PendingWhatsAppToast } from '@/store/whatsappToastStore';

type WaMeMessage = Omit<PendingWhatsAppToast, 'id'>;

interface AnnounceRenewalParams {
  ventaId: string;
  clienteNombre: string;
  /** Mensaje para abrir en WhatsApp (wa.me); null si no hay uno preparado. */
  waMessage: { phone: string; message: string } | null;
  enqueueWhatsAppMessages: (messages: WaMeMessage[]) => void;
}

/**
 * Que ve quien acaba de renovar. Con el WhatsApp automatico encendido todo va por la API, sin preguntar; apagado,
 * se ofrecen los dos canales (API o WhatsApp) si se pidio notificar al cliente. Si la API no pudo enviar estando
 * encendido, se avisa y se deja abrir WhatsApp.
 */
export async function announceRenewal({ ventaId, clienteNombre, waMessage, enqueueWhatsAppMessages }: AnnounceRenewalParams): Promise<void> {
  const pending: WaMeMessage | null = waMessage && {
    ...waMessage, title: 'Venta renovada', description: `Confirmación de renovación para ${clienteNombre}.`,
  };
  const toastId = toast.loading('Venta renovada. Confirmando al cliente...');
  let outcome: Awaited<ReturnType<typeof sendAutomaticRenewalNoticeUseCase>>;
  try {
    outcome = await sendAutomaticRenewalNoticeUseCase(ventaId);
  } catch (error) {
    reportError('RenewalNotice', 'Error enviando la confirmacion de renovacion por la API', error);
    outcome = 'not_sent';
  }

  if (outcome === 'sent') {
    toast.success('Venta renovada y cliente avisado por WhatsApp', { id: toastId });
    return;
  }

  if (outcome === 'auto_disabled') {
    toast.dismiss(toastId);
    if (!pending) {
      toast.success('Venta renovada exitosamente');
      return;
    }
    offerApiAccessNotice({
      tipo: 'renovacion',
      items: [{ ventaId, message: pending }],
      enqueueWhatsAppMessages,
      title: 'Venta renovada exitosamente',
      description: `¿Cómo quieres avisar a ${clienteNombre}?`,
      kind: 'success',
    });
    return;
  }

  toast.warning('Venta renovada, pero no se pudo avisar por la API', {
    id: toastId,
    duration: Infinity,
    description: pending ? 'Puedes enviar la confirmación abriendo WhatsApp.' : 'Escríbele desde el chat.',
    ...(pending ? { action: { label: 'Abrir en WhatsApp', onClick: () => openWhatsAppNow([pending], enqueueWhatsAppMessages) } } : {}),
  });
}
