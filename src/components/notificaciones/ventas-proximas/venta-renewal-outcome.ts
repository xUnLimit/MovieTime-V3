import { announceRenewal } from '@/components/shared/renewal-whatsapp-notice';
import type { PendingWhatsAppToast } from '@/store/whatsappToastStore';

/**
 * Aviso final de una renovacion hecha desde Notificaciones. Con el WhatsApp automatico encendido la confirmacion
 * sale sola por la API; apagado, se ofrecen la API y WhatsApp (con el mensaje editado) si se pidio notificar.
 */
export function showVentaRenewalOutcome(
  { whatsappMessage }: { whatsappMessage?: { phone: string; message: string } },
  notif: { ventaId: string; clienteNombre: string },
  enqueueWhatsAppMessages: (messages: Array<Omit<PendingWhatsAppToast, 'id'>>) => void,
) {
  void announceRenewal({
    ventaId: notif.ventaId,
    clienteNombre: notif.clienteNombre,
    waMessage: whatsappMessage ? { phone: whatsappMessage.phone, message: whatsappMessage.message } : null,
    enqueueWhatsAppMessages,
  });
}
