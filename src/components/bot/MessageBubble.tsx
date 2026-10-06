import { cn } from '@/platform/utils';

type MessageBubbleProps = {
  text: string;
  /** Botones de respuesta rápida que WhatsApp muestra debajo del mensaje. */
  buttons?: readonly string[];
  testId?: string;
  className?: string;
};

/** Burbuja de WhatsApp de solo lectura: muestra el texto como lo recibe el cliente, con sus botones si los tiene. */
export function MessageBubble({ text, buttons = [], testId, className }: MessageBubbleProps) {
  return <div className={cn('rounded-lg border bg-muted p-3', className)}>
    <div className="max-w-[90%] space-y-1.5">
      <div className="rounded-lg rounded-tl-none border bg-card px-3 py-2">
        <p className="text-sm break-words whitespace-pre-wrap" data-testid={testId}>{text || ' '}</p>
        <p aria-hidden className="mt-1 text-right text-xs text-muted-foreground tabular-nums">9:41</p>
      </div>
      {buttons.map((label) => <p key={label} className="rounded-lg border bg-card px-3 py-1.5 text-center text-sm font-medium text-primary-text">{label}</p>)}
    </div>
  </div>;
}
