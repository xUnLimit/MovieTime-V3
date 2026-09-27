import { AlertCircle, Check, CheckCheck, Clock3, Ellipsis, FileText } from 'lucide-react';

import type { WhatsAppChatMessage } from '@/application/use-cases/whatsapp-chat-use-cases';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/platform/utils/cn';
import { CHAT_TEMPLATES, QUICK_REACTIONS, messagePreview, statusLabel } from './chat-format';
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
  canRetry?: (message: WhatsAppChatMessage) => boolean;
};

function StatusIcon({ status }: { status: string }) {
  const label = statusLabel(status);
  if (status === 'pending') return <Clock3 className="h-3.5 w-3.5" aria-label={label} />;
  if (status === 'failed') return <AlertCircle className="h-3.5 w-3.5" aria-label={label} />;
  if (status === 'read') return <CheckCheck className="h-4 w-4 text-sky-300" aria-label={label} />;
  if (status === 'delivered') return <CheckCheck className="h-4 w-4" aria-label={label} />;
  return <Check className="h-4 w-4" aria-label={label} />;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function MessageBubble({ message, continued, quotedByWaMessageId = {}, reactions, highlighted, activeMatch, onReply, onReact, onForward, onRetry, canRetry }: MessageBubbleProps) {
  const outbound = message.direction === 'outbound';
  const failed = message.status === 'failed';
  const templateLabel = message.templateName
    ? CHAT_TEMPLATES.find((item) => item.name === message.templateName)?.label ?? message.templateName
    : null;
  const text = message.mediaId && !message.textBody
    ? null
    : templateLabel ?? messagePreview(message.kind, message.textBody, null);
  const quoted = message.contextWaMessageId ? quotedByWaMessageId[message.contextWaMessageId] : null;
  const location = message.payload?.location;
  const latitude = location && typeof location === 'object' && 'latitude' in location ? location.latitude : null;
  const longitude = location && typeof location === 'object' && 'longitude' in location ? location.longitude : null;
  const locationName = location && typeof location === 'object' && 'name' in location && typeof location.name === 'string' ? location.name : 'Ubicación compartida';
  const contacts = Array.isArray(message.payload?.contacts) ? message.payload.contacts : [];
  const retryAvailable = failed && outbound && (canRetry?.(message) ?? Boolean(message.textBody || message.mediaId));

  return (
    <li data-message-id={message.id} className={cn('flex gap-1 px-3 sm:px-6', outbound ? 'justify-end' : 'justify-start', continued ? 'mt-0.5' : 'mt-2.5')}>
      <div
        className={cn(
          'relative max-w-[82%] rounded-2xl px-3 pb-1.5 pt-2 text-[14.5px] leading-snug shadow-[0_1px_1.5px_rgb(0_0_0/0.18)] sm:max-w-[62%]',
          outbound ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground dark:bg-muted',
          !continued && (outbound ? 'rounded-tr-md' : 'rounded-tl-md'),
          failed && 'bg-destructive/15 text-foreground ring-1 ring-destructive',
          highlighted && 'ring-2 ring-amber-400', activeMatch && 'ring-2 ring-primary'
        )}
      >
        {quoted ? <div className="mb-2 max-w-64 truncate rounded border-l-2 border-current bg-black/10 px-2 py-1 text-xs opacity-80">{messagePreview(quoted.kind, quoted.textBody, quoted.templateName)}</div> : null}
        {templateLabel ? (
          <p
            className={cn(
              'mb-1 flex items-center gap-1 text-[11px] font-medium',
              outbound && !failed ? 'text-primary-foreground/75' : 'text-muted-foreground'
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
        ) : text ? <p className="whitespace-pre-wrap break-words"><WhatsAppText text={text} /></p> : null}
        <p
          className={cn(
            'mt-0.5 flex items-center justify-end gap-1 text-[11px] tabular-nums',
            outbound && !failed ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}
        >
          {formatTime(message.occurredAt)}
          {outbound ? <StatusIcon status={message.status} /> : null}
        </p>
        {failed ? (
          <p className="mt-1 text-[11px] font-medium text-destructive">No se entregó. Revisa el número o intenta de nuevo.</p>
        ) : null}
        {reactions?.mine || reactions?.theirs ? <span className="absolute -bottom-3 right-2 rounded-full border bg-background px-1.5 py-0.5 text-xs text-foreground shadow-sm" aria-label="Reacciones">{reactions.mine && reactions.mine === reactions.theirs ? `${reactions.mine} x2` : [reactions.mine, reactions.theirs].filter(Boolean).join(' ')}</span> : null}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0 self-start" aria-label="Opciones del mensaje"><Ellipsis className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align={outbound ? 'end' : 'start'}>
          {onReact ? <div className="flex gap-0.5 px-1 py-1" aria-label="Reaccionar">{QUICK_REACTIONS.map((emoji) => <button key={emoji} type="button" className="rounded p-1 text-base hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Reaccionar ${emoji}`} onClick={() => onReact(message, reactions?.mine === emoji ? '' : emoji)}>{emoji}</button>)}</div> : null}
          {onReact ? <DropdownMenuSeparator /> : null}
          {onReply ? <DropdownMenuItem onSelect={() => onReply(message)} disabled={!message.waMessageId}>Responder</DropdownMenuItem> : null}
          {onForward && message.mediaId ? <DropdownMenuItem onSelect={() => onForward(message)}>Reenviar</DropdownMenuItem> : null}
          {onRetry && retryAvailable ? <DropdownMenuItem onSelect={() => onRetry(message)}>Reintentar</DropdownMenuItem> : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
