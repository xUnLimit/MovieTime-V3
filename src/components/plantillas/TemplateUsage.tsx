import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { NoticeActivityApi } from '@/hooks/use-template-notices';
import { emptyActivity } from '@/modules/messaging/automation-activity';
import { AUTOMATION_CATALOG, TRIGGER_LABELS } from '@/modules/messaging/automation-catalog';
import { tipoLabel, type EditableTipoKey } from '@/modules/messaging/template-tipos';
import { countLabel, formatDateTime } from './notice-format';

type TemplateUsageProps = {
  tipo: EditableTipoKey;
  activity: NoticeActivityApi;
  /** Abre el historial de envios filtrado por este mensaje. */
  onShowNotices: (tipo: EditableTipoKey) => void;
};

function ActivityLine({ tipo, activity, onShowNotices }: TemplateUsageProps) {
  if (activity.loading) {
    return (
      <div aria-busy="true" className="flex h-7 items-center">
        <Skeleton className="h-4 w-72 max-w-full" />
        <span className="sr-only">Cargando la actividad de los últimos 30 días</span>
      </div>
    );
  }
  if (activity.failed) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-danger">No se pudo cargar la actividad de los últimos 30 días.</p>
        <Button variant="outline" size="sm" onClick={activity.retry}>Reintentar</Button>
      </div>
    );
  }
  const { sent, failed, skipped, lastSentAt } = activity.byTipo[tipo] ?? emptyActivity();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <p className="text-xs text-muted-foreground tabular-nums">
        Últimos 30 días: {countLabel(sent, 'enviado', 'enviados')} · {countLabel(failed, 'fallido', 'fallidos')} · {countLabel(skipped, 'omitido', 'omitidos')}
        {' · '}{lastSentAt ? `último envío ${formatDateTime(lastSentAt)}` : 'sin envíos'}
      </p>
      <Button variant="ghost" size="sm" aria-label={`Ver envíos de ${tipoLabel(tipo)}`} onClick={() => onShowNotices(tipo)}>Ver envíos</Button>
    </div>
  );
}

/** Quién dispara el mensaje, qué hace y cuánto se envió: lo que el editor no muestra del mensaje elegido. */
export function TemplateUsage(props: TemplateUsageProps) {
  const info = AUTOMATION_CATALOG[props.tipo];
  return (
    <section aria-label="Uso de este mensaje" className="space-y-1 border-b px-4 py-3">
      <p className="text-xs"><span className="font-medium">Lo dispara:</span> {info.triggers.map((trigger) => TRIGGER_LABELS[trigger]).join(' · ')}</p>
      <p className="text-xs text-muted-foreground">{info.detail}</p>
      <ActivityLine {...props} />
    </section>
  );
}
