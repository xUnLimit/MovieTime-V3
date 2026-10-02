import Link from 'next/link';

import { Panel } from '@/components/shared/Panel';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AutomationsApi } from '@/hooks/use-automations';
import { formatHour } from './automation-format';

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function Body({ auto }: { auto: AutomationsApi['auto'] }) {
  if (auto.loading) return <div aria-busy="true"><Skeleton className="h-16 w-full" /><span className="sr-only">Cargando envío automático</span></div>;
  const summary = auto.summary;
  if (auto.failed || !summary) {
    return <p role="alert" className="text-sm text-danger">No se pudo leer la configuración del envío automático.</p>;
  }
  const days = summary.daysBefore === null ? 'Sin definir' : `${summary.daysBefore} ${summary.daysBefore === 1 ? 'día' : 'días'} antes`;
  return (
    <div className="space-y-3">
      <dl className="grid gap-3 sm:grid-cols-3">
        <Item label="Hora de envío (Panamá)" value={formatHour(summary.hour)} />
        <Item label="Tope diario" value={`${summary.dailyCap} envíos`} />
        <Item label="Anticipación del aviso" value={days} />
      </dl>
      <p className="text-xs text-muted-foreground">
        {summary.enabled
          ? `Encendido: el aviso de vencimiento sale solo a las ${formatHour(summary.hour)} (hora de Panamá), hasta ${summary.dailyCap} envíos por día; la confirmación de renovación y los avisos de Notificar también salen por la API.`
          : 'Apagado: no sale nada solo. Tú eliges cómo avisar desde Notificaciones, por la API o abriendo WhatsApp.'}
      </p>
    </div>
  );
}

export function AutoSendPanel({ auto }: { auto: AutomationsApi['auto'] }) {
  return (
    <Panel
      title="WhatsApp automático"
      description="Se cambia en Configuración; aquí solo se consulta."
      actions={
        <>
          {auto.summary ? <StatusBadge tone={auto.summary.enabled ? 'success' : 'neutral'}>{auto.summary.enabled ? 'Encendido' : 'Apagado'}</StatusBadge> : null}
          <Button asChild variant="outline" size="sm"><Link href="/configuracion">Cambiar en Configuración</Link></Button>
        </>
      }
    >
      <Body auto={auto} />
    </Panel>
  );
}
