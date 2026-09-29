import { useState } from 'react';
import { AlertCircle, Check, CheckCheck, ChevronDown, Clock3, FileText, List, SmilePlus, Trash2 } from 'lucide-react';

import type { WhatsAppChatMessage } from '@/application/use-cases/whatsapp-chat-use-cases';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/platform/utils/cn';
import { QUICK_REACTIONS, messagePreview, statusLabel } from './chat-format';
import { isInteractiveKind, readInteractiveOptions } from './chat-interactive';
import type { MessageReactions } from './chat-reactions';
import { MessageAttachment } from './MessageAttachment';
import { WhatsAppText } from './WhatsAppText';

type MessageBubbleProps = {
  message: WhatsAppChatMessage;
  continued: boolean;
  quotedByWaMessageId?: Record<string, WhatsAppChatMessage>;
  reactions?: MessageReactions;
  highlighted?: boolean;
  activeMatch?: boolean;
  onReply?: (message: WhatsAppChatMessage) => void;
  onReact?: (message: WhatsAppChatMessage, emoji: string) => void;
  onForward?: (message: WhatsAppChatMessage) => void;
  onRetry?: (message: WhatsAppChatMessage) => void;
  onHide?: (message: WhatsAppChatMessage) => void;
  onOpenImage?: (message: WhatsAppChatMessage, objectUrl: string) => void;
  onSaveSticker?: (message: WhatsAppChatMessage) => void;
  canRetry?: (message: WhatsAppChatMessage) => boolean;
};

function StatusIcon({ status }: { status: string }) {
  const label = statusLabel(status);
  if (status === 'pending') return <Clock3 className="h-3.5 w-3.5" aria-label={label} />;
  if (status === 'failed') return <AlertCircle className="h-3.5 w-3.5" aria-label={label} />;
  if (status === 'read') return <CheckCheck className="h-4 w-4 text-info" aria-label={label} />;
  if (status === 'delivered') return <CheckCheck className="h-4 w-4" aria-label={label} />;
  return <Check className="h-4 w-4" aria-label={label} />;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function MessageBubble({ message, continued, quotedByWaMessageId = {}, reactions, highlighted, activeMatch, onReply, onReact, onForward, onRetry, onHide, onOpenImage, onSaveSticker, canRetry }: MessageBubbleProps) {
  const [confirmHide, setConfirmHide] = useState(false);
  const [reactMenuOpen, setReactMenuOpen] = useState(false);
  const outbound = message.direction === 'outbound';
  const failed = message.status === 'failed';
  const templateLabel = message.templateName;
  const text = message.mediaId && !message.textBody
    ? null
    : templateLabel ?? messagePreview(message.kind, message.textBody, null);
  const quoted = message.contextWaMessageId ? quotedByWaMessageId[message.contextWaMessageId] : null;
  const location = message.payload?.location;
  const latitude = location && typeof location === 'object' && 'latitude' in location ? location.latitude : null;
  const longitude = location && typeof location === 'object' && 'longitude' in location ? location.longitude : null;
  const locationName = location && typeof location === 'object' && 'name' in location && typeof location.name === 'string' ? location.name : 'Ubicación compartida';
  const contacts = Array.isArray(message.payload?.contacts) ? message.payload.contacts : [];
  const interactive = outbound && isInteractiveKind(message.kind) ? readInteractiveOptions(message.payload) : null;
  const retryAvailable = failed && outbound && (canRetry?.(message) ?? Boolean(message.textBody || message.mediaId));
  const isImage = message.kind === 'image' && Boolean(message.mediaId);
  const isSticker = message.kind === 'sticker' && Boolean(message.mediaId);

  const optionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-chat-quiet opacity-0 transition-opacity hover:text-chat-accent-strong focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/message:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100',
            outbound ? 'text-chat-bubble-out-meta' : 'text-chat-muted'
          )}
          aria-label="Opciones del mensaje"
        >
          <ChevronDown className="h-[15px] w-[15px]" strokeWidth={2.25} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={outbound ? 'end' : 'start'} className="chat-menu min-w-[190px]">
        {onReply ? <DropdownMenuItem onSelect={() => onReply(message)} disabled={!message.waMessageId}>Responder</DropdownMenuItem> : null}
        {onForward && message.mediaId ? <DropdownMenuItem onSelect={() => onForward(message)}>Reenviar</DropdownMenuItem> : null}
        {onSaveSticker && isSticker ? <DropdownMenuItem onSelect={() => onSaveSticker(message)}>Guardar sticker</DropdownMenuItem> : null}
        {onRetry && retryAvailable ? <DropdownMenuItem onSelect={() => onRetry(message)}>Reintentar</DropdownMenuItem> : null}
        {onHide ? (
          <>
            {(onReply || (onForward && message.mediaId) || (onSaveSticker && isSticker) || (onRetry && retryAvailable)) ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmHide(true)}>
              <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Eliminar
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const reactButton = onReact ? (
    <DropdownMenu open={reactMenuOpen} onOpenChange={setReactMenuOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-chat-quiet opacity-0 transition-opacity hover:bg-chat-raised hover:text-chat-accent-strong focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/message:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100"
          aria-label="Reaccionar al mensaje"
        >
          <SmilePlus className="h-[18px] w-[18px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={outbound ? 'end' : 'start'} className="chat-menu min-w-0 p-1">
        <div className="flex gap-0.5" aria-label="Reaccionar">{QUICK_REACTIONS.map((emoji) => <button key={emoji} type="button" className="rounded-md p-1 text-base hover:bg-chat-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Reaccionar ${emoji}`} onClick={() => { onReact(message, reactions?.mine === emoji ? '' : emoji); setReactMenuOpen(false); }}>{emoji}</button>)}</div>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <li data-message-id={message.id} className={cn('group/message flex items-center gap-1 px-[13px] sm:px-[clamp(17px,3vw,48px)]', outbound ? 'flex-row-reverse' : 'flex-row', continued ? 'mt-[4px]' : 'mt-[9px]')}>
      <div
        className={cn(
          'relative inline-block w-fit max-w-[80%] pb-[5px] pl-[9px] pr-2 pt-[6px] text-sm leading-[19px] [overflow-wrap:anywhere] sm:max-w-[min(65%,480px)]',
          outbound ? 'bg-chat-bubble-out text-chat-bubble-out-ink' : 'bg-chat-bubble-in text-chat-ink',
          'rounded-md',
          failed && 'bg-destructive/15 text-chat-ink ring-1 ring-destructive',
          highlighted && 'ring-2 ring-chat-accent/60', activeMatch && 'ring-2 ring-chat-accent-strong',
          (reactions?.mine || reactions?.theirs) && 'mb-3'
        )}
      >
        {quoted ? <div className="mb-[6px] max-w-64 truncate rounded-sm border-l-[3px] border-chat-accent bg-black/5 py-1 pl-[7px] pr-2 text-xs text-chat-accent-strong dark:bg-white/5">{messagePreview(quoted.kind, quoted.textBody, quoted.templateName)}</div> : null}
        {templateLabel ? (
          <p
            className={cn(
              'mb-1 flex items-center gap-1 text-xs font-medium',
              outbound && !failed ? 'text-chat-bubble-out-meta' : 'text-chat-muted'
            )}
          >
            <FileText className="h-3 w-3" aria-hidden /> Plantilla
          </p>
        ) : null}
        {message.mediaId ? (
          <div className="mb-1">
            <MessageAttachment
              mediaId={message.mediaId}
              kind={message.kind}
              mimeType={message.mediaMimeType}
              filename={message.mediaFilename}
              onOpenImage={isImage && onOpenImage ? (objectUrl) => onOpenImage(message, objectUrl) : undefined}
            />
          </div>
        ) : null}
        {message.kind === 'location' && typeof latitude === 'number' && typeof longitude === 'number' ? (
          <a className="underline underline-offset-2" href={`https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`} target="_blank" rel="noopener noreferrer">Ubicación: {locationName}</a>
        ) : message.kind === 'contacts' ? (
          <div className="space-y-1">{contacts.map((contact, index) => {
            if (!contact || typeof contact !== 'object' || !('name' in contact) || !('phone' in contact) || typeof contact.name !== 'string' || typeof contact.phone !== 'string') return null;
            return <p key={`${contact.phone}-${index}`}>{contact.name} · {contact.phone}</p>;
          })}</div>
        ) : text && !interactive ? (
          // La hora flota con "float" al final del texto, apoyada abajo (no
          // centrada en la linea) y separada del contenido por el margen
          // izquierdo. Un mensaje corto la deja en la misma linea; uno largo la
          // empuja a su propia linea al final, siempre en la esquina inferior
          // derecha. Solo aplica cuando el texto es lo ultimo de la burbuja: si
          // despues vienen botones o lista, la hora va una sola vez al final.
          // El spacer de la izquierda (float en touch, donde el chevron va
          // siempre visible) reserva su hueco en la primera linea para que no
          // quede flotando encima del texto de un mensaje corto.
          <p className="whitespace-pre-wrap break-words pr-[6px]">
            <span className="float-right ml-1 hidden h-[18px] w-[18px] max-md:block" aria-hidden />
            <WhatsAppText text={text} />
            <span
              className={cn(
                'float-right ml-2.5 inline-flex translate-y-[3px] items-end gap-1 self-end pl-1 text-xs leading-none tabular-nums',
                outbound && !failed ? 'text-chat-bubble-out-meta' : 'text-chat-muted'
              )}
            >
              {formatTime(message.occurredAt)}
              {outbound ? <StatusIcon status={message.status} /> : null}
            </span>
          </p>
        ) : text ? <p className="whitespace-pre-wrap break-words"><WhatsAppText text={text} /></p> : null}
        {interactive ? (
          <div className="mt-1.5 space-y-1" aria-label={interactive.type === 'buttons' ? 'Botones del mensaje' : 'Opciones de la lista'}>
            {interactive.type === 'buttons'
              ? interactive.buttons.map((button) => <div key={button.id} className="rounded-lg bg-black/5 px-2 py-1 text-center text-sm font-medium dark:bg-white/10">{button.title}</div>)
              : <>
                  <div className="flex items-center justify-center gap-1 rounded-lg bg-black/5 px-2 py-1 text-sm font-medium dark:bg-white/10"><List className="h-3.5 w-3.5" aria-hidden />{interactive.buttonLabel}</div>
                  <ul className="space-y-0.5 text-xs opacity-80">{interactive.rows.map((row) => <li key={row.id}>• {row.title}{row.description ? ` — ${row.description}` : ''}</li>)}</ul>
                </>}
          </div>
        ) : null}
        {!text || interactive || message.mediaId ? (
          <p
            className={cn(
              'mt-0.5 flex items-center justify-end gap-1 text-xs tabular-nums',
              outbound && !failed ? 'text-chat-bubble-out-meta' : 'text-chat-muted'
            )}
          >
            {formatTime(message.occurredAt)}
            {outbound ? <StatusIcon status={message.status} /> : null}
          </p>
        ) : null}
        {failed ? (
          <p className="mt-1 text-xs font-medium text-destructive">No se entregó. Revisa el número o intenta de nuevo.</p>
        ) : null}
        {/* El chevron flota sobre la esquina superior derecha, sobre el hueco que dejó el spacer del texto. */}
        <div className="absolute right-[6px] top-[6px]">{optionsMenu}</div>
        {reactions?.mine || reactions?.theirs ? <span className="absolute -bottom-3 right-2 z-[1] flex items-center gap-0.5 whitespace-nowrap rounded-full border border-chat-accent-line bg-chat-accent-soft px-[7px] py-[2px] text-xs leading-none text-chat-accent-strong shadow-sm" aria-label="Reacciones">{reactions.mine && reactions.mine === reactions.theirs ? <>{reactions.mine}<span className="text-xs tabular-nums opacity-80">x2</span></> : [reactions.mine, reactions.theirs].filter(Boolean).join(' ')}</span> : null}
      </div>
      {/* El emoji vive en la fila, no en la burbuja: queda centrado verticalmente
          respecto a toda la altura del mensaje, sin importar cuantas lineas tenga. */}
      {reactButton ? <div className="flex w-7 shrink-0 items-center justify-center self-stretch">{reactButton}</div> : null}
      {onHide ? (
        <AlertDialog open={confirmHide} onOpenChange={setConfirmHide}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar mensaje</AlertDialogTitle>
              <AlertDialogDescription>
                Se quita de tu bandeja. WhatsApp no permite revocar mensajes ya enviados: {outbound ? 'el cliente lo sigue viendo en su chat' : 'este mensaje ya fue recibido y no se puede borrar del lado del cliente'}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => { onHide(message); setConfirmHide(false); }}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </li>
  );
}
