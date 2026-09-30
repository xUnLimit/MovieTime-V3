import { toast } from 'sonner';

import { isNoticeDelivered, sendWhatsAppNoticesUseCase } from '@/application/use-cases/whatsapp-notices-use-cases';
import { reportError } from '@/platform/observability/logger';
import type { PendingWhatsAppToast } from '@/store/whatsappToastStore';

type WaMeMessage = Omit<PendingWhatsAppToast, 'id'>;

type AccessNoticeItem = { ventaId: string; message: WaMeMessage };

interface OfferApiAccessNoticeParams {
  tipo: 'actualizacion_credenciales' | 'transferencia_servicio' | 'renovacion';
  items: AccessNoticeItem[];
  enqueueWhatsAppMessages: (messages: WaMeMessage[]) => void;
  title: string;
  description: string;
  /** Estilo del aviso: informativo por defecto; exito cuando acompana una accion ya completada. */
  kind?: 'info' | 'success';
}

/**
 * Ofrece enviar el aviso por la API de WhatsApp. Lo que la API no acepta (fallo,
 * omitido, wa.me) cae al toast wa.me existente. Sin plantilla vinculada no se usa.
 */
export function offerApiAccessNotice({
  tipo, items, enqueueWhatsAppMessages, title, description, kind = 'info',
}: OfferApiAccessNoticeParams) {
  // Un id por cambio: reintentar el mismo aviso no duplica, pero un cambio nuevo sobre la misma
  // venta sí se envía (antes el servidor lo tomaba por duplicado y no mandaba nada).
  const eventId = crypto.randomUUID();
  const sendViaApi = async () => {
    const loadingId = toast.loading('Enviando por WhatsApp API...');
    try {
      const results = await sendWhatsAppNoticesUseCase({ tipo, ventaIds: items.map((item) => item.ventaId), eventId });
      const delivered = new Set(results.filter((result) => isNoticeDelivered(result.status)).flatMap((result) => result.ventaIds));
      const pending = items.filter((item) => !delivered.has(item.ventaId));
      enqueueWhatsAppMessages(pending.map((item) => item.message));
      if (pending.length === 0) {
        toast.success('Avisos enviados por WhatsApp API', { id: loadingId });
      } else {
        toast.warning('Algunos avisos quedaron pendientes', {
          id: loadingId,
          description: `${pending.length} se pueden enviar abriendo WhatsApp.`,
        });
      }
    } catch (error) {
      reportError('AccessNotice', 'Error enviando aviso por WhatsApp API', error);
      enqueueWhatsAppMessages(items.map((item) => item.message));
      toast.error('No se pudo enviar por la API', {
        id: loadingId,
        description: 'Se prepararon los mensajes para abrirlos en WhatsApp.',
      });
    }
  };

  toast[kind](title, {
    description,
    duration: Infinity,
    action: { label: 'Enviar por WhatsApp API', onClick: () => { void sendViaApi(); } },
    cancel: { label: 'Abrir en WhatsApp', onClick: () => enqueueWhatsAppMessages(items.map((item) => item.message)) },
  });
}
