'use client';

import { forwardRef, useEffect, useLayoutEffect, useRef, useImperativeHandle, useState } from 'react';
import { FileText, Lock, Mic, Paperclip, SendHorizontal, Square, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TemplateMensaje } from '@/types';
import type { WhatsAppUploadResult } from '@/application/use-cases/whatsapp-chat-use-cases';
import { useUploadWhatsAppMedia } from '@/hooks/use-whatsapp-chat';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import type { ServiceWindow } from './chat-format';

export type QuickReply = { tipo: TemplateMensaje['tipo']; label: string };

type ChatComposerProps = {
  draft: string;
  serviceWindow: ServiceWindow;
  isSending: boolean;
  quickReplies: QuickReply[];
  quickReplyContext: string | null;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onQuickReply: (tipo: QuickReply['tipo']) => void;
  onOpenTemplates: () => void;
  replyTarget?: { waMessageId: string; preview: string } | null;
  onCancelReply?: () => void;
  onSendMedia?: (upload: WhatsAppUploadResult, caption: string, onDone: () => void) => void;
};

const MAX_TEXTAREA_PX = 168;
const MAX_MEDIA_BYTES = 4 * 1024 * 1024;
type PendingMedia = { file: File; previewUrl: string | null };

// Formatos de audio que WhatsApp Cloud API acepta, en orden de preferencia;
// audio/webm no esta en esa lista y solo se usa si el navegador no ofrece otro.
const AUDIO_RECORDING_PREFERENCE = ['audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/ogg', 'audio/webm'];
const AUDIO_EXTENSIONS: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
};

export const ChatComposer = forwardRef<HTMLTextAreaElement | null, ChatComposerProps>(function ChatComposer(
  { draft, serviceWindow, isSending, quickReplies, quickReplyContext, onDraftChange, onSend, onQuickReply, onOpenTemplates, replyTarget, onCancelReply, onSendMedia },
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
  const uploadMedia = useUploadWhatsAppMedia();
  useImperativeHandle<HTMLTextAreaElement | null, HTMLTextAreaElement | null>(ref, () => textareaRef.current, []);

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
      if (keep && chunksRef.current.length) {
        // El navegador reporta el mime con el codec (p. ej. "audio/webm;codecs=opus");
        // Meta y el endpoint de subida validan el tipo base, sin ese sufijo.
        const baseType = (recorder.mimeType || 'audio/webm').split(';', 1)[0].trim().toLowerCase();
        const extension = AUDIO_EXTENSIONS[baseType] ?? 'webm';
        selectFile(new File(chunksRef.current, `audio-${Date.now()}.${extension}`, { type: baseType }));
      }
      chunksRef.current = [];
    };
    recorder.stop();
    setRecording(false);
  };

  const startRecording = async () => {
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

  if (!serviceWindow.open) {
    return (
      <div className="flex flex-col gap-3 border-t bg-background px-4 py-3 sm:flex-row sm:items-center">
        <p className="flex flex-1 items-start gap-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>El cliente no ha escrito en las últimas 24 horas. WhatsApp solo permite enviarle una plantilla aprobada; cuando responda, podrás escribirle libremente.</span>
        </p>
        <Button type="button" onClick={onOpenTemplates} className="shrink-0">
          <FileText className="mr-2 h-4 w-4" aria-hidden /> Enviar plantilla
        </Button>
      </div>
    );
  }

  const canSend = draft.trim().length > 0 && !isSending;

  return (
    <form
      className="border-t bg-background px-3 py-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSend();
      }}
    >
      {replyTarget ? <div className="mb-2 flex items-center justify-between rounded border-l-2 border-primary bg-muted/50 px-3 py-1 text-xs"><span className="truncate">Respondiendo a: {replyTarget.preview}</span><Button type="button" size="icon" variant="ghost" className="h-6 w-6" aria-label="Cancelar respuesta" onClick={onCancelReply}><X className="h-3 w-3" /></Button></div> : null}
      {pendingMedia ? <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-2 text-sm">
        {pendingMedia.previewUrl ? <Image src={pendingMedia.previewUrl} alt="Vista previa del archivo" width={64} height={64} unoptimized className="h-16 w-16 rounded object-cover" /> : <FileText className="h-5 w-5" />}
        <span className="max-w-40 truncate">{pendingMedia.file.name}</span>
        {!pendingMedia.file.type.startsWith('audio/') ? <input aria-label="Descripción del archivo" value={caption} onChange={(event) => setCaption(event.target.value)} className="min-w-32 flex-1 rounded border bg-background px-2 py-1" placeholder="Descripción opcional" /> : null}
        <Button type="button" size="sm" variant="ghost" onClick={clearMedia}>Cancelar</Button>
        <Button type="button" size="sm" disabled={uploading || isSending} onClick={() => void sendMedia()}>Enviar archivo</Button>
      </div> : null}
      <div className="flex items-end gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Respuestas rápidas">
            <Zap className="h-5 w-5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-72">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {quickReplyContext ? `Con los datos de ${quickReplyContext}` : 'Elige una venta en el panel del cliente para llenar los datos'}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {quickReplies.length === 0 ? (
            <DropdownMenuItem disabled>No hay plantillas activas en el editor</DropdownMenuItem>
          ) : quickReplies.map((reply) => (
            <DropdownMenuItem key={reply.tipo} disabled={!quickReplyContext} onSelect={() => onQuickReply(reply.tipo)}>
              {reply.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onOpenTemplates}>
            <FileText className="mr-2 h-4 w-4" aria-hidden /> Plantillas de Meta
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,audio/*" className="sr-only" aria-label="Seleccionar archivo" onChange={(event) => { const file = event.target.files?.[0]; if (file) selectFile(file); }} />
      <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Adjuntar archivo" onClick={() => fileRef.current?.click()}><Paperclip className="h-5 w-5" /></Button>
      {recording ? <div className="flex items-center gap-1 text-xs tabular-nums"><span>{Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, '0')}</span><Button type="button" size="icon" variant="ghost" aria-label="Cancelar grabación" onClick={() => stopRecording(false)}><X className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" aria-label="Detener grabación" onClick={() => stopRecording(true)}><Square className="h-4 w-4" /></Button></div> : <Button type="button" size="icon" variant="ghost" className="h-10 w-10 shrink-0" aria-label="Grabar audio" onClick={() => void startRecording()}><Mic className="h-5 w-5" /></Button>}

      <div className="min-w-0 flex-1">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onPaste={(event) => { const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/')); if (image) { event.preventDefault(); selectFile(image); } }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Escribe un mensaje"
          aria-label="Mensaje"
          rows={1}
          maxLength={4096}
          className="block w-full resize-none rounded-2xl border border-input bg-muted/40 px-4 py-2.5 text-[15px] leading-snug outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>

      <Button
        type="submit"
        size="icon"
        disabled={!canSend}
        className="h-10 w-10 shrink-0 rounded-full"
        aria-label="Enviar mensaje"
      >
        <SendHorizontal className="h-5 w-5" aria-hidden />
      </Button>
      </div>
    </form>
  );
});
