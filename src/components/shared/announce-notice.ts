import { toast } from 'sonner';

import {
  notifyCustomerUseCase, type CustomerNoticeTipo, type NotifyCustomerOutcome,
} from '@/application/use-cases/whatsapp-notices-use-cases';
import { offerApiAccessNotice } from '@/components/shared/offer-api-access-notice';
import { openWhatsAppNow } from '@/components/shared/open-whatsapp-now';
import { reportError } from '@/platform/observability/logger';
import type { PendingWhatsAppToast } from '@/store/whatsappToastStore';

type WaMeMessage = Omit<PendingWhatsAppToast, 'id'>;

type AnnounceNoticeItem = {
  ventaId: string;
  /** Mensaje para abrir en WhatsApp (wa.me); null si no hay uno preparado. */
  message: WaMeMessage | null;
};

interface AnnounceNoticeParams {
  tipo: CustomerNoticeTipo;
  items: AnnounceNoticeItem[];
  enqueueWhatsAppMessages: (messages: WaMeMessage[]) => void;
  copy: {
    /** Mientras se intenta el envio por la API. */
    loading: string;
    /** La API aviso a todos. */
    sent: string;
    /** La API no pudo avisar a todos. */
    notSent: string;
    /** Descripcion del aviso de fallo cuando hay mensaje para abrir en WhatsApp. */
    fallbackDescription?: string;
    /** Automatico apagado: aviso que ofrece los dos canales. */
    offerTitle: string;
    offerDescription: string;
    /** Automatico apagado y sin mensaje preparado: solo se confirma la accion (si se indica). */
    withoutMessage?: string;
  };
  /** Estilo del aviso que ofrece los dos canales. */
  kind?: 'info' | 'success';
  /** Identifica el cambio puntual (credenciales, transferencia) para que un reintento no duplique. */
  eventId?: string;
  /** Reemplaza la oferta de los dos canales cuando el automatico esta apagado. */
  onAutoDisabled?: () => void | Promise<void>;
}

const NOT_SENT: NotifyCustomerOutcome = { status: 'not_sent', deliveredVentaIds: [] };

function uniqueMessages(items: AnnounceNoticeItem[]): WaMeMessage[] {
  const messages = items.map((item) => item.message).filter((message): message is WaMeMessage => message !== null);
  return [...new Set(messages)];
}

/**
 * Regla unica de envio tras una accion del panel. Con el WhatsApp automatico encendido el aviso sale por la API
 * sin preguntar; si la API no lo entrego se advierte y se deja abrir WhatsApp. Apagado, se ofrecen los dos canales
 * (API o WhatsApp) con los mensajes preparados.
 */
export async function announceNotice({
  tipo, items, enqueueWhatsAppMessages, copy, kind = 'info', eventId = crypto.randomUUID(), onAutoDisabled,
}: AnnounceNoticeParams): Promise<NotifyCustomerOutcome['status']> {
  const toastId = toast.loading(copy.loading);
  let outcome: NotifyCustomerOutcome;
  try {
    outcome = await notifyCustomerUseCase({ tipo, ventaIds: items.map((item) => item.ventaId), eventId });
  } catch (error) {
    reportError('AnnounceNotice', 'Error enviando el aviso automatico por la API', error);
    outcome = NOT_SENT;
  }

  if (outcome.status === 'sent') {
    toast.success(copy.sent, { id: toastId });
    return outcome.status;
  }

  if (outcome.status === 'auto_disabled') {
    toast.dismiss(toastId);
    if (onAutoDisabled) {
      await onAutoDisabled();
      return outcome.status;
    }
    const offerItems = items.flatMap((item) => (item.message ? [{ ventaId: item.ventaId, message: item.message }] : []));
    if (offerItems.length === 0) {
      if (copy.withoutMessage) toast.success(copy.withoutMessage);
      return outcome.status;
    }
    offerApiAccessNotice({
      tipo, items: offerItems, enqueueWhatsAppMessages, title: copy.offerTitle, description: copy.offerDescription, kind, eventId,
    });
    return outcome.status;
  }

  const delivered = new Set(outcome.deliveredVentaIds);
  const pending = uniqueMessages(items.filter((item) => !delivered.has(item.ventaId)));
  toast.warning(copy.notSent, {
    id: toastId,
    duration: Infinity,
    description: pending.length === 0
      ? 'Escríbele desde el chat.'
      : copy.fallbackDescription ?? (pending.length === 1
        ? 'Puedes enviar el aviso abriendo WhatsApp.'
        : `${pending.length} avisos se pueden enviar abriendo WhatsApp.`),
    ...(pending.length > 0
      ? { action: { label: 'Abrir en WhatsApp', onClick: () => openWhatsAppNow(pending, enqueueWhatsAppMessages) } }
      : {}),
  });
  return outcome.status;
}
