'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { WhatsAppChatMessage, WhatsAppConversation, WhatsAppSendMessage, WhatsAppUploadResult } from '@/application/use-cases/whatsapp-chat-use-cases';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { useVentasTercero } from '@/hooks/use-ventas-tercero';
import {
  useHideWhatsAppMessage,
  useMarkWhatsAppConversationRead,
  useMarkWhatsAppConversationUnread,
  useSendWhatsAppMessage,
  useVentaMessageContext,
  useWhatsAppMessages,
} from '@/hooks/use-whatsapp-chat';
import { useSaveChatSticker } from '@/hooks/use-chat-saved-stickers';
import { useMetaTemplates, useTemplates } from '@/hooks/use-templates';
import type { TipoTemplate } from '@/types';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { cn } from '@/platform/utils/cn';
import { readChatDraft, writeChatDraft } from '@/modules/whatsapp/chat-drafts';
import { ChatComposer } from './ChatComposer';
import { ChatHeader } from './ChatHeader';
import { getServiceWindow, messagePreview } from './chat-format';
import { rebuildInteractiveMessage } from './chat-interactive';
import { searchMessages } from './chat-search';
import { buildMetaTemplateParams, buildTemplateOptions, suggestTipoByDueDate } from './chat-templates';
import { CustomerPanel, sortVentasForChat } from './CustomerPanel';
import { ImageLightbox } from './ImageLightbox';
import { MessageTimeline } from './MessageTimeline';
import { ForwardDialog } from './ForwardDialog';
import { TemplateSendDialog } from './TemplateSendDialog';

const FIND_ICON = 'grid h-[31px] w-[31px] shrink-0 place-items-center rounded-lg text-chat-muted transition-colors hover:bg-chat-selected hover:text-chat-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45';

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
  const { ventas, isLoading: ventasLoading } = useVentasTercero(conversation.terceroId ?? '');
  const sendMessage = useSendWhatsAppMessage();
  const { mutate: markRead } = useMarkWhatsAppConversationRead();
  const markUnread = useMarkWhatsAppConversationUnread();
  const hideMessage = useHideWhatsAppMessage(waId);
  const saveSticker = useSaveChatSticker();

  const { data: tipoTemplates = [] } = useTemplates();
  const { data: metaTemplates = [] } = useMetaTemplates();
  const templateOptions = useMemo(() => buildTemplateOptions(tipoTemplates, metaTemplates), [tipoTemplates, metaTemplates]);

  const activas = useMemo(() => sortVentasForChat(ventas), [ventas]);
  const [chosenVentaId, setChosenVentaId] = useState<string | null>(null);
  const selectedVenta = activas.find((venta) => venta.id === chosenVentaId) ?? activas[0] ?? null;
  const { data: ventaContext = null } = useVentaMessageContext(selectedVenta?.id ?? null);

  const [draft, setDraft] = useState(() => (typeof window === 'undefined' ? '' : readChatDraft(waId)));
  const [replyTarget, setReplyTarget] = useState<{ waMessageId: string; preview: string } | null>(null);
  const [forwardMessage, setForwardMessage] = useState<WhatsAppChatMessage | null>(null);
  const [openImage, setOpenImage] = useState<{ message: WhatsAppChatMessage; objectUrl: string } | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const matchIds = useMemo(() => searchMessages(messages, searchQuery), [messages, searchQuery]);
  const shownMatchIndex = matchIds.length ? Math.min(activeMatchIndex, matchIds.length - 1) : 0;
  const [panelOverlay, setPanelOverlay] = useState(false);
  const [wideWorkspace, setWideWorkspace] = useState(false);
  const [templateDialog, setTemplateDialog] = useState<{ open: boolean; tipo: TipoTemplate; key: number }>({
    open: false, tipo: 'notificacion_regular', key: 0,
  });
  // Una clave por intento: si la red falla y se reintenta, el servidor devuelve
  // el mismo envio en lugar de mandarle el mensaje dos veces al cliente.
  const attemptKey = useRef<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  // Tras "Marcar como no leído" el chat abierto deja de marcarse como leído solo;
  // si no, la recarga de la lista revertía la marca en milisegundos.
  const autoReadEnabled = useRef(true);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(min-width: 1600px)');
    const update = () => {
      setWideWorkspace(media.matches);
      if (media.matches) setPanelOverlay(false);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const serviceWindow = getServiceWindow(conversation.lastInboundAt, now);
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

  const openTemplates = (tipo?: TipoTemplate) => {
    setTemplateDialog((current) => ({
      open: true,
      tipo: tipo ?? suggestTipoByDueDate(ventaContext?.fechaVencimiento ?? selectedVenta?.fechaFin ?? null, now),
      key: current.key + 1,
    }));
  };

  const togglePanel = () => {
    // En pantallas anchas el panel es una columna fija; en el resto se superpone.
    if (wideWorkspace) {
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
      now={now}
      onSelectVenta={setChosenVentaId}
      onOpenTemplate={openTemplates}
      onClose={() => {
        setPanelOverlay(false);
        onPanelPreferredChange(false);
      }}
    />
  );

  return (
    <div className={cn('relative grid h-full min-h-0', panelPreferred ? 'min-[1600px]:grid-cols-[minmax(0,1fr)_306px]' : 'grid-cols-1')}>
      <div className="flex min-h-0 min-w-0 flex-col">
        <ChatHeader
          conversation={conversation}
          serviceWindow={serviceWindow}
          panelOpen={wideWorkspace ? panelPreferred : panelOverlay}
          searchOpen={searchActive}
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
        {searchActive ? <div className="flex items-center gap-[9px] border-b border-chat-line bg-chat-raised px-3 py-2 md:px-5">
          <Search className="h-[15px] w-[15px] shrink-0 text-chat-quiet" strokeWidth={1.6} aria-hidden />
          <input autoFocus aria-label="Buscar en la conversación" placeholder="Buscar en los mensajes" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setActiveMatchIndex(0); }} className="min-w-0 flex-1 bg-transparent text-[16px] text-chat-ink outline-none placeholder:text-chat-quiet sm:text-[13px]" />
          <span className="min-w-[35px] text-center text-[11px] tabular-nums text-chat-muted">{matchIds.length ? `${shownMatchIndex + 1}/${matchIds.length}` : '0/0'}</span>
          <button type="button" className={FIND_ICON} aria-label="Resultado anterior" disabled={!matchIds.length} onClick={() => setActiveMatchIndex((index) => (index - 1 + matchIds.length) % matchIds.length)}><ChevronUp className="h-[15px] w-[15px]" /></button>
          <button type="button" className={FIND_ICON} aria-label="Resultado siguiente" disabled={!matchIds.length} onClick={() => setActiveMatchIndex((index) => (index + 1) % matchIds.length)}><ChevronDown className="h-[15px] w-[15px]" /></button>
          <button type="button" className={FIND_ICON} aria-label="Cerrar búsqueda" onClick={() => { setSearchActive(false); setSearchQuery(''); }}><X className="h-[15px] w-[15px]" /></button>
        </div> : null}
        <MessageTimeline key={waId} messages={messages} isLoading={isLoading} unreadCount={conversation.unreadCount} now={now} searchQuery={searchActive ? searchQuery : ''} matchIds={matchIds} activeMatchIndex={shownMatchIndex} canRetry={canRetry}
          onReply={(message) => { if (message.waMessageId) { setReplyTarget({ waMessageId: message.waMessageId, preview: messagePreview(message.kind, message.textBody, message.templateName) }); composerRef.current?.focus(); } }}
          onReact={(message, emoji) => { if (message.waMessageId) sendExtra(waId, { kind: 'reaction', targetWaMessageId: message.waMessageId, emoji }); }}
          onForward={setForwardMessage} onRetry={retryMessage}
          onHide={(message) => hideMessage.mutate({ messageId: message.id, direction: message.direction }, {
            onError: (error) => toast.error(getPublicErrorMessage(error, 'No se pudo eliminar el mensaje. Intenta de nuevo.')),
          })}
          onOpenImage={(message, objectUrl) => setOpenImage({ message, objectUrl })}
          onSaveSticker={(message) => {
            if (!message.mediaId || !message.mediaMimeType) return;
            saveSticker.mutate({ mediaId: message.mediaId, mimeType: message.mediaMimeType }, {
              onSuccess: () => toast.success('Sticker guardado.'),
              onError: (error) => toast.error(getPublicErrorMessage(error, 'No se pudo guardar el sticker.')),
            });
          }} />
        <ChatComposer
          ref={composerRef}
          draft={draft}
          serviceWindow={serviceWindow}
          isSending={sendMessage.isPending}
          onDraftChange={updateDraft}
          replyTarget={replyTarget}
          onCancelReply={() => setReplyTarget(null)}
          onSend={() => {
            const message: WhatsAppSendMessage = { kind: 'text', text: draft.trim(), ...(replyTarget ? { replyTo: replyTarget.waMessageId } : {}) };
            updateDraft('');
            setReplyTarget(null);
            send(message, () => {});
          }}
          onSendMedia={(upload: WhatsAppUploadResult, caption, onDone) => {
            if (upload.mimeType === 'image/webp') {
              sendExtra(waId, { kind: 'sticker', mediaId: upload.mediaId, mimeType: upload.mimeType, replyTo: replyTarget?.waMessageId }, () => { onDone(); setReplyTarget(null); });
              return;
            }
            const kind = upload.mimeType.startsWith('image/') ? 'image' : upload.mimeType.startsWith('audio/') ? 'audio' : 'document';
            sendExtra(waId, { kind, mediaId: upload.mediaId, mimeType: upload.mimeType, filename: upload.filename, caption: caption || undefined, replyTo: replyTarget?.waMessageId }, () => { onDone(); setReplyTarget(null); });
          }}
          onSendInteractive={(message, onDone) => sendExtra(waId, { ...message, ...(replyTarget ? { replyTo: replyTarget.waMessageId } : {}) }, () => { onDone(); setReplyTarget(null); })}
          onSendSticker={(sticker, onDone) => sendExtra(waId, { kind: 'sticker', mediaId: sticker.mediaId, mimeType: sticker.mimeType, replyTo: replyTarget?.waMessageId }, () => { onDone(); setReplyTarget(null); })}
          onOpenTemplates={() => openTemplates()}
          conversation={conversation}
          ventaContext={ventaContext}
        />
      </div>

      {panelPreferred ? <div className="hidden min-h-0 border-l border-chat-line min-[1600px]:block">{panel}</div> : null}
      {panelOverlay ? (
        <div className={cn('absolute inset-0 z-20 md:left-auto md:w-[min(350px,90vw)] md:border-l md:border-chat-selected-line md:shadow-[-18px_0_50px_rgb(0_0_0/0.5)]', panelPreferred && 'min-[1600px]:hidden')}>
          {panel}
        </div>
      ) : null}

      <TemplateSendDialog
        key={templateDialog.key}
        open={templateDialog.open}
        options={templateOptions}
        initialTipo={templateDialog.tipo}
        paramsFor={(option) => buildMetaTemplateParams(option.tipo, ventaContext, fallbackName)}
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
        if (!message || !message.mediaId || !message.mediaMimeType || !['image', 'document', 'audio', 'sticker'].includes(message.kind)) {
          toast.error('Este archivo no se puede reenviar desde la conversación.');
          return;
        }
        if (message.kind === 'sticker') {
          sendExtra(to, { kind: 'sticker', mediaId: message.mediaId, mimeType: message.mediaMimeType }, () => setForwardMessage(null));
          return;
        }
        const kind = message.kind === 'image' ? 'image' : message.kind === 'audio' ? 'audio' : 'document';
        sendExtra(to, { kind, mediaId: message.mediaId, mimeType: message.mediaMimeType, filename: message.mediaFilename ?? undefined, caption: message.textBody ?? undefined }, () => setForwardMessage(null));
      }} />

      {openImage ? <ImageLightbox src={openImage.objectUrl} alt="Imagen del mensaje" filename={openImage.message.mediaFilename} onClose={() => setOpenImage(null)} /> : null}
    </div>
  );
}
