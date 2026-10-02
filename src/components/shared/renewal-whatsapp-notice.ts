import { announceNotice } from '@/components/shared/announce-notice';
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
 * Que ve quien acaba de renovar: aplica la regla unica de `announceNotice`. Con el automatico encendido la
 * confirmacion sale por la API aunque no se haya preparado mensaje (el cliente pago); apagado, se ofrecen los
 * dos canales solo si se pidio notificar al cliente.
 */
export async function announceRenewal({ ventaId, clienteNombre, waMessage, enqueueWhatsAppMessages }: AnnounceRenewalParams): Promise<void> {
  await announceNotice({
    tipo: 'renovacion',
    items: [{
      ventaId,
      message: waMessage && { ...waMessage, title: 'Venta renovada', description: `Confirmación de renovación para ${clienteNombre}.` },
    }],
    enqueueWhatsAppMessages,
    kind: 'success',
    copy: {
      loading: 'Venta renovada. Confirmando al cliente...',
      sent: 'Venta renovada y cliente avisado por WhatsApp',
      notSent: 'Venta renovada, pero no se pudo avisar por la API',
      fallbackDescription: 'Puedes enviar la confirmación abriendo WhatsApp.',
      offerTitle: 'Venta renovada exitosamente',
      offerDescription: `¿Cómo quieres avisar a ${clienteNombre}?`,
      withoutMessage: 'Venta renovada exitosamente',
    },
  });
}
