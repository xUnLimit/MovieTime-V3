'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { isNoticeDelivered } from '@/application/use-cases/whatsapp-notices-use-cases';
import { offerApiAccessNotice } from '@/components/shared/offer-api-access-notice';
import { openWhatsAppNow } from '@/components/shared/open-whatsapp-now';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useConfig } from '@/hooks/use-config';
import { useTemplates, useMetaTemplates } from '@/hooks/use-templates';
import { useSendNotices } from '@/hooks/use-whatsapp-notices';
import { isUsableMetaTemplate } from '@/modules/messaging/meta-template-mapping';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { queryKeys } from '@/platform/query-keys';
import { useWhatsAppToastStore } from '@/store/whatsappToastStore';

import { buildNoticePreview, noticeTipoFor } from './notice-helpers';
import type { NotificacionVentaConId } from './types';

interface NotifyVentaDialogProps {
  notification: NotificacionVentaConId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type NotificationChoice = 'expiration' | 'cancellation';

/**
 * Notificar a un cliente desde Notificaciones. Con el WhatsApp automatico encendido, "Enviar" manda el aviso por
 * la API y confirma con un aviso; apagado, cierra el dialogo y ofrece abajo las dos opciones (API o WhatsApp).
 */
export function NotifyVentaDialog({ notification, open, onOpenChange }: NotifyVentaDialogProps) {
  const [choice, setChoice] = useState<NotificationChoice>('expiration');
  const { data: templates = [] } = useTemplates();
  const { data: metaTemplates = [] } = useMetaTemplates();
  const { data: config } = useConfig();
  const sendNotices = useSendNotices();
  const queryClient = useQueryClient();
  const enqueueWhatsAppMessages = useWhatsAppToastStore((state) => state.enqueueMany);

  const tipo = choice === 'expiration' ? noticeTipoFor() : 'cancelacion';
  const template = templates.find((item) => item.tipo === tipo && item.activo);
  const usesApiTemplate = Boolean(
    template?.metaTemplateName
      && metaTemplates.some((meta) => meta.name === template.metaTemplateName && isUsableMetaTemplate(meta)),
  );
  const templateContent = template?.contenido;
  const preview = useMemo(
    () => (templateContent ? buildNoticePreview(notification, templateContent) : null),
    [notification, templateContent],
  );
  const autoOn = config?.whatsapp?.autoEnabled === true;
  const isBusy = sendNotices.isPending;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setChoice('expiration');
    onOpenChange(nextOpen);
  };

  const refreshNoticeStatus = () => queryClient.invalidateQueries({ queryKey: queryKeys.whatsapp.noticeStatus() });

  const waMessage = preview
    ? {
        phone: notification.clienteTelefono ?? '',
        message: preview,
        title: choice === 'expiration' ? 'Aviso de pago' : 'Aviso de corte',
        description: `Mensaje para ${notification.clienteNombre}.`,
      }
    : null;

  const warnNotSent = (description: string) => toast.warning('El aviso no se pudo enviar por la API', {
    description,
    duration: Infinity,
    ...(waMessage ? { action: { label: 'Abrir en WhatsApp', onClick: () => openWhatsAppNow([waMessage], enqueueWhatsAppMessages) } } : {}),
  });

  const handleSend = async () => {
    if (!waMessage && !autoOn) {
      toast.error('No hay un mensaje configurado para este aviso.', {
        description: 'Crea o activa la plantilla en Plantillas de mensajes.',
      });
      return;
    }

    if (!autoOn) {
      handleOpenChange(false);
      offerApiAccessNotice({
        tipo,
        items: [{ ventaId: notification.ventaId, message: waMessage! }],
        enqueueWhatsAppMessages,
        title: choice === 'expiration' ? 'Aviso de pago listo' : 'Aviso de corte listo',
        description: `¿Cómo quieres avisar a ${notification.clienteNombre}?`,
        onApiSettled: () => { void refreshNoticeStatus(); },
      });
      return;
    }

    try {
      const sent = await sendNotices.mutateAsync({ tipo, ventaIds: [notification.ventaId] });
      if (sent.length > 0 && sent.every((result) => isNoticeDelivered(result.status))) {
        toast.success('Aviso enviado por WhatsApp API', { description: `Se notificó a ${notification.clienteNombre}.` });
      } else {
        warnNotSent(waMessage ? 'Puedes enviarlo abriendo WhatsApp.' : 'Escríbele desde el chat.');
      }
    } catch (error) {
      warnNotSent(getPublicErrorMessage(error, waMessage ? 'Puedes enviarlo abriendo WhatsApp.' : 'Escríbele desde el chat.'));
    }
    handleOpenChange(false);
  };

  const channelNote = autoOn
    ? usesApiTemplate
      ? 'Se enviará por WhatsApp API (plantilla con botones)'
      : 'Este aviso no tiene una plantilla aprobada para la API: se te ofrecerá abrirlo en WhatsApp'
    : 'Al enviar, elige entre la API o WhatsApp';

  return (
    <Dialog open={open} onOpenChange={isBusy ? undefined : handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[470px]">
        <DialogHeader>
          <DialogTitle>Notificar a {notification.clienteNombre}</DialogTitle>
          <DialogDescription>
            Selecciona el mensaje que quieres enviar.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={choice}
          onValueChange={(value) => setChoice(value as NotificationChoice)}
          className="gap-2"
        >
          <label
            htmlFor="notify-expiration"
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
              choice === 'expiration'
                ? 'border-success-border bg-success-subtle'
                : 'hover:bg-muted/50'
            }`}
          >
            <RadioGroupItem
              id="notify-expiration"
              value="expiration"
              aria-label="Aviso de pago"
              className="mt-0.5"
            />
            <MessageSquare className="mt-0.5 h-4 w-4 text-success" />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">Aviso de pago</span>
              <span className="block text-xs text-muted-foreground">
                Usa el aviso regular o de día de pago según el vencimiento.
              </span>
            </span>
          </label>

          <label
            htmlFor="notify-cancellation"
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
              choice === 'cancellation'
                ? 'border-danger-border bg-danger-subtle'
                : 'hover:bg-muted/50'
            }`}
          >
            <RadioGroupItem
              id="notify-cancellation"
              value="cancellation"
              aria-label="Cancelación"
              className="mt-0.5"
            />
            <XCircle className="mt-0.5 h-4 w-4 text-danger" />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">Cancelación</span>
              <span className="block text-xs text-muted-foreground">
                Prepara el mensaje de cancelación del servicio.
              </span>
            </span>
          </label>
        </RadioGroup>

        {preview ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Vista previa</p>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 font-sans text-sm">{preview}</pre>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground" data-testid="notice-channel">
          {channelNote}
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={isBusy} onClick={() => handleOpenChange(false)}>
            Volver
          </Button>
          <Button type="button" disabled={isBusy} onClick={handleSend}>
            {isBusy ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
