import { cn } from '@/platform/utils/cn';

type ServiceTagsProps = {
  /** Servicios activos del cliente; salen solos de sus ventas, no se editan a mano. */
  categories: readonly string[];
  /** Cuantas etiquetas se ven; el resto se resume en un "+N" para que la fila no se llene. */
  max?: number;
  className?: string;
};

const TAG = 'inline-flex h-[18px] min-w-0 items-center rounded-md border border-chat-line bg-chat-raised px-1.5 text-xs font-medium leading-none text-chat-muted';

export function ServiceTags({ categories, max = 2, className }: ServiceTagsProps) {
  if (categories.length === 0) return null;
  const shown = categories.slice(0, max);
  const hidden = categories.slice(max);

  return (
    <span role="group" aria-label={`Servicios activos: ${categories.join(', ')}`} className={cn('flex min-w-0 items-center gap-1 overflow-hidden', className)}>
      {shown.map((name) => (
        <span key={name} className={cn(TAG, 'max-w-[110px] shrink')} title={name}>
          <span className="truncate">{name}</span>
        </span>
      ))}
      {hidden.length > 0 ? (
        <span className={cn(TAG, 'shrink-0 tabular-nums')} title={hidden.join(', ')} aria-hidden>+{hidden.length}</span>
      ) : null}
    </span>
  );
}
