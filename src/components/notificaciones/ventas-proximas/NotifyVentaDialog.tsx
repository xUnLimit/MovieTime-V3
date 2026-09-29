'use client';

import { useMemo, useState } from 'react';
import { MessageSquare, XCircle } from 'lucide-react';
import { toast } from 'sonner';

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
import { useTemplates, useMetaTemplates } from '@/hooks/use-templates';
import { useSendNotices } from '@/hooks/use-whatsapp-notices';
import { isUsableMetaTemplate } from '@/modules/messaging/meta-template-mapping';
import type { NoticeResult } from '@/platform/api/whatsapp-notices-client';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { openWhatsApp as openWaMe } from '@/platform/utils/whatsapp';

import { NoticeResultList } from './NoticeResultList';
import { buildNoticePreview, noticeTipoFor, resolveResultWaMe } from './notice-helpers';
import type { NotificacionVentaConId } from './types';

type MessageAction = (notification: NotificacionVentaConId) =>
  | boolean
  | Promise<boolean>;

interface NotifyVentaDialogProps {
  notification: NotificacionVentaConId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNotify: MessageAction;
  onCancelMessage: MessageAction;
}

type NotificationChoice = 'expiration' | 'cancellation';

export function NotifyVentaDialog({
  notification,
  open,
  onOpenChange,
  onNotify,
  onCancelMessage,
}: NotifyVentaDialogProps) {
  const [choice, setChoice] = useState<NotificationChoice>('expiration');
  const [isOpeningWhatsApp, setIsOpeningWhatsApp] = useState(false);
  const [results, setResults] = useState<NoticeResult[] | null>(null);
  const { data: templates = [] } = useTemplates();
  const { data: metaTemplates = [] } = useMetaTemplates();
  const sendNotices = useSendNotices();

  const tipo = choice === 'expiration' ? noticeTipoFor() : 'cancelacion';
  const template = templates.find((item) => item.tipo === tipo && item.activo);
  const usesApiTemplate = Boolean(
    template?.metaTemplateName
      && metaTemplates.some((meta) => meta.name === template.metaTemplateName && isUsableMetaTemplate(meta)),
  );
  const preview = useMemo(
    () => (template?.contenido ? buildNoticePreview(notification, template.contenido) : null),
    [notification, template?.contenido],
  );
  const isBusy = sendNotices.isPending || isOpeningWhatsApp;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setChoice('expiration');
      setResults(null);
    }
    onOpenChange(nextOpen);
  };

  const openWhatsApp = async () => {
    setIsOpeningWhatsApp(true);
    try {
      const succeeded = choice === 'expiration'
        ? await onNotify(notification)
        : await onCancelMessage(notification);
      return succeeded !== false;
    } finally {
      setIsOpeningWhatsApp(false);
    }
  };

  // Respaldo de un resultado: texto del servidor o agrupado local; si no hay, el flujo de una venta.
  const openResultWhatsApp = async (result: NoticeResult) => {
    const resolved = resolveResultWaMe(result, [notification], template?.contenido);
    if (resolved) {
      openWaMe(resolved.phone, resolved.text);
      return;
    }
    await openWhatsApp();
  };

  const handleOpenWhatsApp = async () => {
    if (await openWhatsApp()) handleOpenChange(false);
  };

  const handleSend = async () => {
    try {
      setResults(await sendNotices.mutateAsync({ tipo, ventaIds: [notification.ventaId] }));
    } catch (error) {
      toast.error('No se pudo enviar por la API', {
        description: getPublicErrorMessage(error, 'Puedes abrirlo en WhatsApp.'),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={isBusy ? undefined : handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[470px]">
        <DialogHeader>
          <DialogTitle>Notificar a {notification.clienteNombre}</DialogTitle>
          <DialogDescription>
            Selecciona el mensaje y envíalo por la API o ábrelo en WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={choice}
          onValueChange={(value) => { setChoice(value as NotificationChoice); setResults(null); }}
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
          {usesApiTemplate
            ? 'Se enviará por WhatsApp API (plantilla con botones)'
            : 'Se abrirá WhatsApp'}
        </p>

        {results ? (
          <NoticeResultList results={results} onOpenWhatsApp={(result) => { void openResultWhatsApp(result); }} />
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={isBusy} onClick={() => handleOpenChange(false)}>
            {results ? 'Cerrar' : 'Volver'}
          </Button>
          <Button type="button" variant="outline" disabled={isBusy} onClick={handleOpenWhatsApp}>
            Abrir en WhatsApp
          </Button>
          <Button type="button" disabled={isBusy} onClick={handleSend}>
            {sendNotices.isPending ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
