import type { WhatsAppChatMessage } from '@/application/use-cases/whatsapp-chat-use-cases';
import { cn } from '@/platform/utils/cn';
import { formatChatTime, messagePreview, statusLabel } from './chat-format';

type MessageBubbleProps = {
  message: WhatsAppChatMessage;
  now: Date;
};

export function MessageBubble({ message, now }: MessageBubbleProps) {
  const outbound = message.direction === 'outbound';
  const failed = message.status === 'failed';

  return (
    <li className={cn('flex', outbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]',
          outbound ? 'rounded-br-sm bg-emerald-700 text-white' : 'rounded-bl-sm bg-muted text-foreground',
          failed && 'bg-destructive/15 text-foreground ring-1 ring-destructive'
        )}
      >
        {message.templateName ? (
          <p className={cn('mb-1 text-xs font-medium', outbound && !failed ? 'text-emerald-100' : 'text-muted-foreground')}>
            Plantilla
          </p>
        ) : null}
        <p className="whitespace-pre-wrap break-words">
          {messagePreview(message.kind, message.textBody, message.templateName)}
        </p>
        <p className={cn('mt-1 text-right text-[11px]', outbound && !failed ? 'text-emerald-100' : 'text-muted-foreground')}>
          {formatChatTime(message.occurredAt, now)}
          {outbound ? ` · ${statusLabel(message.status)}` : ''}
        </p>
      </div>
    </li>
  );
}
