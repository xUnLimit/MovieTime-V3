import { useConversationControl } from '@/hooks/use-conversation-control';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function ConversationControl({ waId }: { waId: string }) {
  const { owner, change, allowed } = useConversationControl(waId);
  if (!allowed) return null;
  if (owner.isLoading) return <Skeleton className="h-8 w-32" aria-label="Cargando atención" />;
  if (owner.isError) return <div role="alert" className="text-xs text-danger">No se pudo cargar la atención. <Button variant="outline" onClick={() => owner.refetch()}>Reintentar</Button></div>;
  return <div className="flex flex-wrap items-center gap-2">
    <StatusBadge tone={owner.data === 'humano' ? 'info' : 'neutral'}>{owner.data === 'humano' ? 'Tu' : 'Bot atendiendo'}</StatusBadge>
    {<Button variant="outline" disabled={change.isPending || owner.isFetching} onClick={() => change.mutate(owner.data === 'humano' ? 'bot' : 'humano')}>{change.isPending ? 'Cambiando...' : owner.data === 'humano' ? 'Devolver al bot' : 'Tomar conversación'}</Button>}
    {change.isError && <p role="alert" className="text-xs text-danger">No se pudo cambiar la atención. Reintenta.</p>}
  </div>;
}
