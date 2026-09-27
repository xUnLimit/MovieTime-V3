'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { WhatsAppChatMessage, WhatsAppConversation, WhatsAppSendMessage, WhatsAppUploadResult } from '@/application/use-cases/whatsapp-chat-use-cases';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTemplates } from '@/hooks/use-templates';
import { useVentasTercero } from '@/hooks/use-ventas-tercero';
import {
  useMarkWhatsAppConversationRead,
  useMarkWhatsAppConversationUnread,
  useSendWhatsAppMessage,
  useVentaMessageContext,
  useWhatsAppMessages,
} from '@/hooks/use-whatsapp-chat';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { cn } from '@/platform/utils/cn';
import { renderEditorTemplate } from '@/platform/utils/whatsapp-template-render';
import { readChatDraft, writeChatDraft } from '@/modules/whatsapp/chat-drafts';
import { ChatComposer, type QuickReply } from './ChatComposer';
import { ChatHeader } from './ChatHeader';
import { getServiceWindow, messagePreview, type ChatTemplate } from './chat-format';
import { rebuildInteractiveMessage } from './chat-interactive';
import { searchMessages } from './chat-search';
import { buildMetaTemplateParams, quickRepliesFrom, suggestMetaTemplate } from './chat-templates';
import { CustomerPanel, sortVentasForChat } from './CustomerPanel';
import { MessageTimeline } from './MessageTimeline';
import { ForwardDialog } from './ForwardDialog';
import { TemplateSendDialog } from './TemplateSendDialog';

type ChatWorkspaceProps = {
  conversation: WhatsAppConversation;
  now: Date;
  panelPreferred: boolean;
  onPanelPreferredChange: (open: boolean) => void;
  onBack: () => void;
  conversations?: WhatsAppConversation[];
};

export function ChatWorkspace({ conversation, now, panelPreferred, onPanelPreferredChange, onBack, conversations = [] }: ChatWorkspaceProps) {
  const { waId } = conversation;
  const { data: messages = [], isLoading } = useWhatsAppMessages(waId);
  const { data: templates = [] } = useTemplates();
  const { ventas, isLoading: ventasLoading } = useVentasTercero(conversation.terceroId ?? '');
  const sendMessage = useSendWhatsAppMessage();
  const { mutate: markRead } = useMarkWhatsAppConversationRead();
  const markUnread = useMarkWhatsAppConversationUnread();

  const activas = useMemo(() => sortVentasForChat(ventas), [ventas]);
  const [chosenVentaId, setChosenVentaId] = useState<string | null>(null);
  const selectedVenta = activas.find((venta) => venta.id === chosenVentaId) ?? activas[0] ?? null;
  const { data: ventaContext = null } = useVentaMessageContext(selectedVenta?.id ?? null);

  const [draft, setDraft] = useState(() => (typeof window === 'undefined' ? '' : readChatDraft(waId)));
  const [replyTarget, setReplyTarget] = useState<{ waMessageId: string; preview: string } | null>(null);
  const [forwardMessage, setForwardMessage] = useState<WhatsAppChatMessage | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const matchIds = useMemo(() => searchMessages(messages, searchQuery), [messages, searchQuery]);
  const shownMatchIndex = matchIds.length ? Math.min(activeMatchIndex, matchIds.length - 1) : 0;
  const [panelOverlay, setPanelOverlay] = useState(false);
  const [templateDialog, setTemplateDialog] = useState<{ open: boolean; name: ChatTemplate['name']; key: number }>({
    open: false, name: 'recordatorio_vencimiento', key: 0,
  });
  // Una clave por intento: si la red falla y se reintenta, el servidor devuelve
  // el mismo envio en lugar de mandarle el mensaje dos veces al cliente.
  const attemptKey = useRef<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  // Tras "Marcar como no leído" el chat abierto deja de marcarse como leído solo;
  // si no, la recarga de la lista revertía la marca en milisegundos.
  const autoReadEnabled = useRef(true);

  const serviceWindow = getServiceWindow(conversation.lastInboundAt, now);
  const quickReplies = useMemo(() => quickRepliesFrom(templates), [templates]);
  const contextLabel = selectedVenta ? `${selectedVenta.categoriaNombre}` : null;
  const fallbackName = conversation.terceroNombre || conversation.contactName || '';

  const updateDraft = (value: string) => {
    setDraft(value);
    writeChatDraft(waId, value);
  };

  const canRetry = (message: WhatsAppChatMessage) => (message.kind === 'text' && Boolean(message.textBody))
    || (['image', 'document', 'audio'].includes(message.kind) && Boolean(message.mediaId && message.mediaMimeType))
    || rebuildInteractiveMessage(message) !== null;

  const sendExtra = (to: string, message: WhatsAppSendMessage, onDone?: () => void) => {
    sendMessage.mutate({ to, message, idempotencyKey: crypto.randomUUID() }, {
      onSuccess: (result) => {
        if (result.sendStatus === 'failed') { toast.error(`WhatsApp rechazó el mensaje: ${result.errorTitle ?? 'error desconocido'}`); return; }
        onDone?.();
      },
      onError: (error) => toast.error(getPublicErrorMessage(error, 'No se pudo enviar el mensaje. Intenta de nuevo.')),
    });
  };

  const retryMessage = (message: WhatsAppChatMessage) => {
    const interactive = rebuildInteractiveMessage(message);
    if (interactive) {
      sendExtra(waId, interactive);
    } else if (message.kind === 'text' && message.textBody) {
      sendExtra(waId, { kind: 'text', text: message.textBody, replyTo: message.contextWaMessageId ?? undefined });
    } else if ((message.kind === 'image' || message.kind === 'document' || message.kind === 'audio') && message.mediaId && message.mediaMimeType) {
      sendExtra(waId, { kind: message.kind, mediaId: message.mediaId, mimeType: message.mediaMimeType, filename: message.mediaFilename ?? undefined, caption: message.textBody ?? undefined, replyTo: message.contextWaMessageId ?? undefined });
    } else toast.error('No hay datos suficientes para reintentar este mensaje.');
  };

  useEffect(() => {
    if (autoReadEnabled.current && conversation.unreadCount > 0) {
      markRead({ waId, readAt: new Date().toISOString() });
    }
  }, [conversation.unreadCount, markRead, waId]);

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

  const applyQuickReply = (tipo: QuickReply['tipo']) => {
    const template = templates.find((item) => item.tipo === tipo && item.activo !== false);
    if (!template || !ventaContext) {
      toast.error('Elige una venta del cliente para llenar el mensaje.');
      return;
    }
    updateDraft(renderEditorTemplate(template.contenido, ventaContext));
    setPanelOverlay(false);
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  const openTemplates = (name?: ChatTemplate['name']) => {
    setTemplateDialog((current) => ({
      open: true,
      name: name ?? suggestMetaTemplate(ventaContext?.fechaVencimiento ?? selectedVenta?.fechaFin ?? null, now),
      key: current.key + 1,
    }));
  };

  const togglePanel = () => {
    // En pantallas anchas el panel es una columna fija; en el resto se superpone.
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches) {
      onPanelPreferredChange(!panelPreferred);
    } else {
      setPanelOverlay((open) => !open);
    }
  };

  const panel = (
    <CustomerPanel
      conversation={conversation}
      serviceWindow={serviceWindow}
      activas={activas}
      ventasLoading={ventasLoading}
      selectedVentaId={selectedVenta?.id ?? null}
      quickReplies={quickReplies}
      now={now}
      onSelectVenta={setChosenVentaId}
      onQuickReply={applyQuickReply}
      onOpenTemplate={openTemplates}
      onClose={() => {
        setPanelOverlay(false);
        onPanelPreferredChange(false);
      }}
    />
  );

  return (
    <div className={cn('relative grid h-full min-h-0', panelPreferred ? 'xl:grid-cols-[minmax(0,1fr)_320px]' : 'grid-cols-1')}>
      <div className="flex min-h-0 min-w-0 flex-col">
        <ChatHeader
          conversation={conversation}
          serviceWindow={serviceWindow}
          panelOpen={panelPreferred || panelOverlay}
          onBack={onBack}
          onTogglePanel={togglePanel}
          onToggleSearch={() => setSearchActive((active) => !active)}
          onMarkUnread={() => {
            if (conversation.lastInboundAt) {
              autoReadEnabled.current = false;
              markUnread.mutate({ waId, lastInboundAt: conversation.lastInboundAt }, { onSuccess: onBack });
            }
          }}
        />
        {searchActive ? <div className="flex items-center gap-1 border-b bg-background px-3 py-2">
          <Input autoFocus aria-label="Buscar en la conversación" placeholder="Buscar mensajes" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setActiveMatchIndex(0); }} className="h-8 flex-1" />
          <span className="min-w-12 text-center text-xs tabular-nums text-muted-foreground">{matchIds.length ? `${shownMatchIndex + 1}/${matchIds.length}` : '0/0'}</span>
          <Button type="button" size="icon" variant="ghost" aria-label="Resultado anterior" disabled={!matchIds.length} onClick={() => setActiveMatchIndex((index) => (index - 1 + matchIds.length) % matchIds.length)}><ArrowUp className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Resultado siguiente" disabled={!matchIds.length} onClick={() => setActiveMatchIndex((index) => (index + 1) % matchIds.length)}><ArrowDown className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Cerrar búsqueda" onClick={() => { setSearchActive(false); setSearchQuery(''); }}><X className="h-4 w-4" /></Button>
        </div> : null}
        <MessageTimeline key={waId} messages={messages} isLoading={isLoading} unreadCount={conversation.unreadCount} now={now} searchQuery={searchActive ? searchQuery : ''} matchIds={matchIds} activeMatchIndex={shownMatchIndex} canRetry={canRetry}
          onReply={(message) => { if (message.waMessageId) { setReplyTarget({ waMessageId: message.waMessageId, preview: messagePreview(message.kind, message.textBody, message.templateName) }); composerRef.current?.focus(); } }}
          onReact={(message, emoji) => { if (message.waMessageId) sendExtra(waId, { kind: 'reaction', targetWaMessageId: message.waMessageId, emoji }); }}
          onForward={setForwardMessage} onRetry={retryMessage} />
        <ChatComposer
          ref={composerRef}
          draft={draft}
          serviceWindow={serviceWindow}
          isSending={sendMessage.isPending}
          quickReplies={quickReplies}
          quickReplyContext={ventaContext ? contextLabel : null}
          onDraftChange={updateDraft}
          replyTarget={replyTarget}
          onCancelReply={() => setReplyTarget(null)}
          onSend={() => send({ kind: 'text', text: draft.trim(), ...(replyTarget ? { replyTo: replyTarget.waMessageId } : {}) }, () => { updateDraft(''); setReplyTarget(null); })}
          onSendMedia={(upload: WhatsAppUploadResult, caption, onDone) => {
            const kind = upload.mimeType.startsWith('image/') ? 'image' : upload.mimeType.startsWith('audio/') ? 'audio' : 'document';
            sendExtra(waId, { kind, mediaId: upload.mediaId, mimeType: upload.mimeType, filename: upload.filename, caption: caption || undefined, replyTo: replyTarget?.waMessageId }, () => { onDone(); setReplyTarget(null); });
          }}
          onSendInteractive={(message, onDone) => sendExtra(waId, { ...message, ...(replyTarget ? { replyTo: replyTarget.waMessageId } : {}) }, () => { onDone(); setReplyTarget(null); })}
          onQuickReply={applyQuickReply}
          onOpenTemplates={() => openTemplates()}
        />
      </div>

      {panelPreferred ? <div className="hidden min-h-0 border-l xl:block">{panel}</div> : null}
      {panelOverlay ? (
        <div className={cn('absolute inset-0 z-20 md:left-auto md:w-[340px] md:border-l md:shadow-[-8px_0_24px_rgb(0_0_0/0.2)]', panelPreferred && 'xl:hidden')}>
          {panel}
        </div>
      ) : null}

      <TemplateSendDialog
        key={templateDialog.key}
        open={templateDialog.open}
        initialTemplate={templateDialog.name}
        paramsFor={(name) => buildMetaTemplateParams(name, ventaContext, fallbackName)}
        contextLabel={ventaContext ? contextLabel : null}
        isSending={sendMessage.isPending}
        onOpenChange={(open) => setTemplateDialog((current) => ({ ...current, open }))}
        onSend={(templateName, params) => send(
          { kind: 'template', templateName, params },
          () => setTemplateDialog((current) => ({ ...current, open: false }))
        )}
      />
      <ForwardDialog open={Boolean(forwardMessage)} conversations={conversations} onOpenChange={(open) => { if (!open) setForwardMessage(null); }} onForward={(to) => {
        const message = forwardMessage;
        if (!message || !message.mediaId || !message.mediaMimeType || !['image', 'document', 'audio'].includes(message.kind)) {
          toast.error('Este archivo no se puede reenviar desde la conversación.');
          return;
        }
        const kind = message.kind === 'image' ? 'image' : message.kind === 'audio' ? 'audio' : 'document';
        sendExtra(to, { kind, mediaId: message.mediaId, mimeType: message.mediaMimeType, filename: message.mediaFilename ?? undefined, caption: message.textBody ?? undefined }, () => setForwardMessage(null));
      }} />

    </div>
  );
}
