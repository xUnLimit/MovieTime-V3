'use client';

import { forwardRef, useEffect, useLayoutEffect, useRef, useImperativeHandle, useState } from 'react';
import { Bookmark, ClipboardList, FileText, ListChecks, Lock, Mic, Paperclip, Plus, Send, Sticker as StickerIcon, Square, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { WhatsAppConversation, WhatsAppUploadResult } from '@/application/use-cases/whatsapp-chat-use-cases';
import { useUploadWhatsAppMedia } from '@/hooks/use-whatsapp-chat';
import type { SavedSticker } from '@/application/use-cases/chat-saved-sticker-use-cases';
import type { SavedMessage } from '@/modules/whatsapp/saved-messages';
import type { VentaMessageContext } from '@/platform/utils/whatsapp-template-render';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { cn } from '@/platform/utils/cn';
import { ChatActionsDialog } from './ChatActionsDialog';
import type { ServiceWindow } from './chat-format';
import { buildInteractiveMessage, type InteractiveDraft, type InteractiveSendMessage } from './chat-interactive';
import { AUDIO_EXTENSIONS, AUDIO_RECORDING_PREFERENCE } from './chat-audio-formats';
import { InteractiveMessageDialog } from './InteractiveMessageDialog';
import { SavedMessagesDialog } from './SavedMessagesDialog';
import { SlashSuggestions } from './SlashSuggestions';
import type { SlashItem } from './chat-slash';
import { useSlashItems } from './useSlashItems';
import { StickerPickerDialog } from './StickerPickerDialog';

type ChatComposerProps = {
  draft: string;
  serviceWindow: ServiceWindow;
  isSending: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onOpenTemplates: () => void;
  replyTarget?: { waMessageId: string; preview: string } | null;
  onCancelReply?: () => void;
  onSendMedia?: (upload: WhatsAppUploadResult, caption: string, onDone: () => void) => void;
  onSendInteractive?: (message: InteractiveSendMessage, onDone: () => void) => void;
  onSendSticker?: (sticker: SavedSticker, onDone: () => void) => void;
  conversation?: WhatsAppConversation;
  ventaContext?: VentaMessageContext | null;
};

const MAX_TEXTAREA_PX = 160;
const TOOL_ICON = 'grid h-10 w-10 shrink-0 place-items-center rounded-md text-chat-muted transition-colors hover:bg-chat-selected hover:text-chat-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const TOOL_ICON_SMALL = 'grid h-[31px] w-[31px] shrink-0 place-items-center rounded-lg text-chat-accent-strong transition-colors hover:bg-chat-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const MAX_MEDIA_BYTES = 4 * 1024 * 1024;
type PendingMedia = { file: File; previewUrl: string | null };

export const ChatComposer = forwardRef<HTMLTextAreaElement | null, ChatComposerProps>(function ChatComposer(
  { draft, serviceWindow, isSending, onDraftChange, onSend, onOpenTemplates, replyTarget, onCancelReply, onSendMedia, onSendInteractive, onSendSticker, conversation, ventaContext = null },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [caption, setCaption] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [interactive, setInteractive] = useState<{ open: boolean; key: number; initialDraft?: InteractiveDraft }>({ open: false, key: 0 });
  const [savedMessagesOpen, setSavedMessagesOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [slashActiveIndex, setSlashActiveIndex] = useState(0);
  const uploadMedia = useUploadWhatsAppMedia();
  useImperativeHandle<HTMLTextAreaElement | null, HTMLTextAreaElement | null>(ref, () => textareaRef.current, []);

  const fallbackName = conversation?.terceroNombre || conversation?.contactName || '';
  const { items: slashSuggestions, term: slashTerm } = useSlashItems(draft, ventaContext, fallbackName);
  useEffect(() => setSlashActiveIndex(0), [slashTerm]);

  // El cuadro crece con el texto hasta un maximo, como en WhatsApp.
  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, [draft]);

  useEffect(() => () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => () => {
    if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
  }, [pendingMedia]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const selectFile = (file: File) => {
    if (file.size > MAX_MEDIA_BYTES) {
      toast.error('El archivo no puede superar 4 MB.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) && !file.type.startsWith('audio/')) {
      toast.error('Formato de archivo no compatible.');
      return;
    }
    setPendingMedia((previous) => {
      if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
      return { file, previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null };
    });
    setCaption('');
  };

  const clearMedia = () => {
    if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
    setPendingMedia(null);
    setCaption('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const sendMedia = async () => {
    if (!pendingMedia || !onSendMedia || uploading) return;
    setUploading(true);
    try {
      const upload = await uploadMedia.mutateAsync({ file: pendingMedia.file, filename: pendingMedia.file.name });
      onSendMedia(upload, caption.trim(), clearMedia);
    } catch (error) {
      toast.error(getPublicErrorMessage(error, 'No se pudo subir el archivo. Intenta de nuevo.'));
    } finally {
      setUploading(false);
    }
  };

  const stopRecording = (keep: boolean) => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorder.onstop = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      if (keep) {
        if (!chunksRef.current.length) {
          toast.error('No se pudo grabar el audio. Intenta de nuevo.');
        } else {
          // El navegador reporta el mime con el codec (p. ej. "audio/webm;codecs=opus");
          // Meta y el endpoint de subida validan el tipo base, sin ese sufijo.
          const baseType = (recorder.mimeType || 'audio/webm').split(';', 1)[0].trim().toLowerCase();
          const extension = AUDIO_EXTENSIONS[baseType] ?? 'webm';
          selectFile(new File(chunksRef.current, `audio-${Date.now()}.${extension}`, { type: baseType }));
        }
      }
      chunksRef.current = [];
    };
    recorder.stop();
    setRecording(false);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Este navegador no permite grabar audio. Prueba abriendo el sitio directamente en Safari.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Se prefieren los formatos que WhatsApp acepta de forma nativa; audio/webm
      // queda como ultimo recurso porque no esta documentado como soportado.
      const mimeType = AUDIO_RECORDING_PREFERENCE.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.start();
      setRecordSeconds(0);
      setRecording(true);
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      toast.error(getPublicErrorMessage(error, 'No se pudo acceder al micrófono.'));
    }
  };

  const applySlashItem = (item: SlashItem) => {
    if (item.kind === 'saved') { applySavedMessage(item.message); return; }
    onDraftChange(item.body);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const applySavedMessage = (message: SavedMessage) => {
    setSavedMessagesOpen(false);
    if (message.kind === 'text') {
      onDraftChange(message.body);
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }
    onDraftChange('');
    if (!onSendInteractive) return;
    const result = buildInteractiveMessage({ type: message.kind, body: message.body, buttonLabel: message.buttonLabel, options: message.options });
    if (!result.ok) { toast.error(result.error); return; }
    onSendInteractive(result.message, () => {});
  };

  if (!serviceWindow.open) {
    return (
      <>
      <div className="flex flex-col gap-3 border-t border-chat-line bg-chat-surface px-3 pb-[calc(13px+env(safe-area-inset-bottom))] pt-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-[18px] md:pb-[15px] md:pt-[13px]">
        <p className="flex flex-1 items-start gap-2 text-xs leading-normal text-chat-muted">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-chat-closed-ink" aria-hidden />
          <span>
            <strong className="mb-0.5 block text-sm text-chat-ink">Ventana de atención cerrada</strong>
            El cliente no ha escrito en las últimas 24 horas. WhatsApp solo permite enviarle una plantilla aprobada; cuando responda, podrás escribirle libremente.
          </span>
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => setSavedMessagesOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-md border border-chat-line px-3.5 py-[11px] text-xs font-semibold text-chat-ink hover:bg-chat-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Bookmark className="h-4 w-4" aria-hidden />Gestionar mensajes</button>
          <button type="button" onClick={onOpenTemplates} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-chat-accent px-3.5 py-[11px] text-xs font-semibold text-chat-accent-ink transition-colors hover:bg-chat-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-chat-surface">
            <FileText className="h-4 w-4" aria-hidden /> Enviar plantilla
          </button>
        </div>
      </div>
      {savedMessagesOpen ? <SavedMessagesDialog open onOpenChange={setSavedMessagesOpen} onUse={applySavedMessage} canUse={false} /> : null}
      </>
    );
  }

  const hasDraft = draft.trim().length > 0;
  const canSend = hasDraft && !isSending;

  return (
    <form
      className="relative border-t border-chat-line bg-chat-surface px-3 pb-[calc(13px+env(safe-area-inset-bottom))] pt-2.5 md:px-[18px] md:pb-[15px] md:pt-[13px]"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSend();
      }}
    >
      {slashSuggestions.length > 0 ? (
        <SlashSuggestions
          items={slashSuggestions}
          activeIndex={slashActiveIndex}
          onHover={setSlashActiveIndex}
          onSelect={applySlashItem}
        />
      ) : null}
      {replyTarget ? <div className="mb-[11px] flex items-center justify-between gap-3 rounded-lg bg-chat-selected py-1 pl-[13px] pr-1 text-xs text-chat-accent-strong"><span className="truncate">Respondiendo a: {replyTarget.preview}</span><button type="button" className={TOOL_ICON_SMALL} aria-label="Cancelar respuesta" onClick={onCancelReply}><X className="h-[15px] w-[15px]" /></button></div> : null}
      {pendingMedia ? <div className="mb-[11px] flex flex-wrap items-center gap-2 rounded-lg bg-chat-selected p-2 text-xs text-chat-accent-strong">
        {pendingMedia.previewUrl ? <Image src={pendingMedia.previewUrl} alt="Vista previa del archivo" width={64} height={64} unoptimized className="h-16 w-16 rounded-md object-cover" /> : <FileText className="h-5 w-5" aria-hidden />}
        <span className="max-w-40 truncate">{pendingMedia.file.name}</span>
        {!pendingMedia.file.type.startsWith('audio/') && pendingMedia.file.type !== 'image/webp' ? <input aria-label="Descripción del archivo" value={caption} onChange={(event) => setCaption(event.target.value)} className="min-w-32 flex-1 rounded-lg border border-chat-line bg-chat-raised px-2.5 py-1.5 text-base text-chat-ink outline-none placeholder:text-chat-quiet focus:border-chat-accent sm:text-sm" placeholder="Descripción opcional" /> : null}
        <button type="button" className="rounded-lg px-3 py-2 text-chat-muted transition-colors hover:bg-chat-hover hover:text-chat-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={clearMedia}>Cancelar</button>
        <button type="button" className="rounded-lg bg-chat-accent px-3 py-2 font-semibold text-chat-accent-ink transition-colors hover:bg-chat-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-45" disabled={uploading || isSending} onClick={() => void sendMedia()}>Enviar archivo</button>
      </div> : null}
      <div className="flex items-end gap-1.5">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,audio/*" className="sr-only" aria-label="Seleccionar archivo" onChange={(event) => { const file = event.target.files?.[0]; if (file) selectFile(file); }} />
        {recording ? (
          <div className="flex h-[42px] items-center gap-1 rounded-lg bg-chat-closed pl-3 text-xs tabular-nums text-chat-closed-ink">
            <span className="h-2 w-2 rounded-full bg-current motion-safe:animate-pulse" aria-hidden />
            <span>{Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, '0')}</span>
            <button type="button" className={TOOL_ICON} aria-label="Cancelar grabación" onClick={() => stopRecording(false)}><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn(TOOL_ICON, 'mb-px data-[state=open]:bg-chat-selected data-[state=open]:text-chat-accent-strong')} aria-label="Abrir acciones" title="Adjuntar o usar plantillas">
                <Plus className="h-[19px] w-[19px]" strokeWidth={1.6} aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="chat-menu w-64">
              <DropdownMenuItem onSelect={() => fileRef.current?.click()}><Paperclip className="mr-2 h-4 w-4" aria-hidden /> Adjuntar archivo</DropdownMenuItem>
              {onSendInteractive ? <DropdownMenuItem onSelect={() => setInteractive((current) => ({ open: true, key: current.key + 1 }))}><ListChecks className="mr-2 h-4 w-4" aria-hidden /> Botones o lista</DropdownMenuItem> : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onOpenTemplates}>
                <FileText className="mr-2 h-4 w-4" aria-hidden /> Plantillas de Meta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {!recording ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn(TOOL_ICON, 'mb-px data-[state=open]:bg-chat-selected data-[state=open]:text-chat-accent-strong')} aria-label="Respuestas rápidas y acciones" title="Respuestas rápidas y acciones">
                <Zap className="h-[19px] w-[19px]" strokeWidth={1.8} fill="currentColor" fillOpacity={0.15} aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="chat-menu w-56">
              <DropdownMenuItem onSelect={() => setSavedMessagesOpen(true)}><Zap className="mr-2 h-4 w-4" aria-hidden /> Mensajes guardados</DropdownMenuItem>
              {conversation ? <DropdownMenuItem onSelect={() => setActionsOpen(true)}><ClipboardList className="mr-2 h-4 w-4" aria-hidden /> Acciones</DropdownMenuItem> : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {!recording && onSendSticker ? (
          <button type="button" className={cn(TOOL_ICON, 'mb-px')} aria-label="Stickers" title="Stickers" onClick={() => setStickersOpen(true)}>
            <StickerIcon className="h-[19px] w-[19px]" strokeWidth={1.8} aria-hidden />
          </button>
        ) : null}

        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => {
            const value = event.target.value;
            onDraftChange(value);
          }}
          onPaste={(event) => { const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/')); if (image) { event.preventDefault(); selectFile(image); } }}
          onKeyDown={(event) => {
            if (slashSuggestions.length > 0) {
              if (event.key === 'ArrowDown') { event.preventDefault(); setSlashActiveIndex((index) => (index + 1) % slashSuggestions.length); return; }
              if (event.key === 'ArrowUp') { event.preventDefault(); setSlashActiveIndex((index) => (index - 1 + slashSuggestions.length) % slashSuggestions.length); return; }
              if (event.key === 'Escape') { event.preventDefault(); onDraftChange(''); return; }
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                applySlashItem(slashSuggestions[slashActiveIndex]);
                return;
              }
            }
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Escribe un mensaje"
          aria-label="Mensaje"
          rows={1}
          maxLength={4096}
          className="block min-h-[42px] min-w-0 flex-1 resize-none rounded-lg border border-chat-line bg-chat-raised px-[13px] py-[11px] text-base leading-[1.4] text-chat-ink outline-none transition-colors placeholder:text-chat-quiet focus:border-chat-accent md:text-sm"
        />

        <button
          type={hasDraft ? 'submit' : 'button'}
          disabled={hasDraft ? isSending : recording}
          onClick={hasDraft ? undefined : () => void startRecording()}
          className="grid h-[42px] min-w-[42px] shrink-0 place-items-center rounded-lg bg-chat-accent text-chat-accent-ink transition-[background-color,transform] duration-150 ease-out hover:bg-chat-accent-strong active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-chat-surface disabled:pointer-events-none disabled:opacity-45"
          aria-label={hasDraft ? 'Enviar mensaje' : 'Grabar audio'}
        >
          {hasDraft ? <Send className="h-[19px] w-[19px]" strokeWidth={1.6} aria-hidden /> : <Mic className="h-[19px] w-[19px]" strokeWidth={1.6} aria-hidden />}
        </button>
        {recording ? (
          <button type="button" className={cn(TOOL_ICON, 'bg-chat-accent text-chat-accent-ink hover:bg-chat-accent-strong')} aria-label="Detener grabación" onClick={() => stopRecording(true)}><Square className="h-4 w-4" /></button>
        ) : null}
      </div>
      {savedMessagesOpen ? <SavedMessagesDialog open onOpenChange={setSavedMessagesOpen} onUse={applySavedMessage} /> : null}
      {onSendInteractive ? <InteractiveMessageDialog key={interactive.key} open={interactive.open} isSending={isSending} initialDraft={interactive.initialDraft}
        onOpenChange={(open) => setInteractive((current) => ({ ...current, open }))}
        onSend={(message) => onSendInteractive(message, () => setInteractive((current) => ({ ...current, open: false })))} /> : null}
      {onSendSticker ? <StickerPickerDialog open={stickersOpen} onOpenChange={setStickersOpen}
        onSelect={(sticker) => onSendSticker(sticker, () => setStickersOpen(false))} /> : null}
      {conversation ? <ChatActionsDialog open={actionsOpen} onOpenChange={setActionsOpen} conversation={conversation} /> : null}
    </form>
  );
});
