'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, SendHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import type { WhatsAppConversation, WhatsAppSendMessage } from '@/application/use-cases/whatsapp-chat-use-cases';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useMarkWhatsAppConversationRead, useSendWhatsAppMessage, useWhatsAppMessages } from '@/hooks/use-whatsapp-chat';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { getSaludo } from '@/platform/utils/whatsapp';
import { conversationTitle, formatWaId, getServiceWindow } from './chat-format';
import { MessageBubble } from './MessageBubble';
import { TemplateSendDialog } from './TemplateSendDialog';

type ChatThreadProps = {
  conversation: WhatsAppConversation;
  now: Date;
  onBack: () => void;
};

export function ChatThread({ conversation, now, onBack }: ChatThreadProps) {
  const { waId } = conversation;
  const { data: messages = [], isLoading } = useWhatsAppMessages(waId);
  const sendMessage = useSendWhatsAppMessage();
  const markRead = useMarkWhatsAppConversationRead();
  const [draft, setDraft] = useState('');
  const [templateOpen, setTemplateOpen] = useState(false);
  // Una clave por intento: si la red falla y se reintenta, el servidor devuelve
  // el mismo envio en lugar de mandarle el mensaje dos veces al cliente.
  const attemptKey = useRef<string | null>(null);
  const endRef = useRef<HTMLLIElement>(null);
  const serviceWindow = getServiceWindow(conversation.lastInboundAt, now);
  const { mutate: markReadMutate } = markRead;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, waId]);

  useEffect(() => {
    if (conversation.unreadCount > 0) {
      markReadMutate({ waId, readAt: new Date().toISOString() });
    }
  }, [conversation.unreadCount, markReadMutate, waId]);

  const send = (message: WhatsAppSendMessage, onDone: () => void) => {
    attemptKey.current ??= crypto.randomUUID();
    sendMessage.mutate(
      { to: waId, message, idempotencyKey: attemptKey.current },
      {
        onSuccess: (result) => {
          attemptKey.current = null;
          if (result.sendStatus === 'failed') {
            toast.error(`WhatsApp rechazó el mensaje: ${result.errorTitle ?? 'error desconocido'}`);
            return;
          }
          onDone();
        },
        onError: (error) => {
          toast.error(getPublicErrorMessage(error, 'No se pudo enviar el mensaje. Intenta de nuevo.'));
        },
      }
    );
  };

  const greeting = `${getSaludo()}, ${(conversation.terceroNombre || conversation.contactName || '').split(' ')[0]}`
    .replace(/, $/, '');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b px-3 py-2">
        <Button type="button" variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label="Volver a la lista">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{conversationTitle(conversation)}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {formatWaId(waId)}
            {conversation.terceroId ? (
              <>
                {' · '}
                <Link prefetch={false} href={`/terceros/${conversation.terceroId}`} className="underline underline-offset-2">
                  Ver cliente
                </Link>
              </>
            ) : ' · No registrado'}
          </p>
        </div>
      </header>

      <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4" aria-label="Mensajes" aria-live="polite">
        {isLoading ? <li className="text-sm text-muted-foreground">Cargando mensajes...</li> : null}
        {messages.map((message) => <MessageBubble key={message.id} message={message} now={now} />)}
        <li ref={endRef} aria-hidden className="h-px" />
      </ol>

      <div className="border-t p-3">
        {serviceWindow.open ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft.trim();
              if (text) send({ kind: 'text', text }, () => setDraft(''));
            }}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Ventana abierta · {serviceWindow.hoursLeft} h restantes
              </p>
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Escribe un mensaje"
                aria-label="Mensaje"
                rows={2}
                maxLength={4096}
                className="max-h-40 resize-none"
              />
            </div>
            <Button type="button" variant="outline" size="icon" onClick={() => setTemplateOpen(true)} aria-label="Enviar plantilla">
              <FileText className="h-5 w-5" />
            </Button>
            <Button type="submit" size="icon" disabled={!draft.trim() || sendMessage.isPending} aria-label="Enviar mensaje">
              <SendHorizontal className="h-5 w-5" />
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              El cliente no ha escrito en las últimas 24 horas. Solo puedes enviarle una plantilla.
            </p>
            <Button type="button" onClick={() => setTemplateOpen(true)}>
              <FileText className="mr-2 h-4 w-4" /> Enviar plantilla
            </Button>
          </div>
        )}
      </div>

      <TemplateSendDialog
        key={`${waId}-${templateOpen}`}
        open={templateOpen}
        greeting={greeting}
        isSending={sendMessage.isPending}
        onOpenChange={setTemplateOpen}
        onSend={(templateName, params) => send({ kind: 'template', templateName, params }, () => setTemplateOpen(false))}
      />
    </div>
  );
}
