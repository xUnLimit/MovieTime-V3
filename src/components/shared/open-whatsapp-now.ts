import { openWhatsApp } from '@/platform/utils/whatsapp';
import type { PendingWhatsAppToast } from '@/store/whatsappToastStore';

type WaMeMessage = Omit<PendingWhatsAppToast, 'id'>;

/**
 * Para usar dentro de un clic del usuario: el navegador permite abrir una ventana por clic,
 * asi que el primer mensaje con telefono se abre de inmediato y el resto espera en la cola de
 * pendientes (un boton por mensaje). Sin telefono no hay a donde abrir: queda en la cola, que
 * ofrece copiar el mensaje.
 */
export function openWhatsAppNow(
  messages: readonly WaMeMessage[],
  enqueueWhatsAppMessages: (messages: WaMeMessage[]) => void,
) {
  const [first, ...rest] = messages;
  if (!first) return;
  if (!first.phone) {
    enqueueWhatsAppMessages([...messages]);
    return;
  }
  openWhatsApp(first.phone, first.message);
  if (rest.length > 0) enqueueWhatsAppMessages(rest);
}
