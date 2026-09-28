'use client';

import { RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  metaStatusLabel,
  resizeParamMap,
  type MetaTemplateInfo,
} from '@/modules/messaging/meta-template-mapping';
import { MetaParamMapEditor } from './MetaParamMapEditor';

const NONE = '__none__';

type MetaTemplateSectionProps = {
  templates: MetaTemplateInfo[];
  linkedName: string | null;
  paramMap: string[];
  mapError: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  onSync: () => void;
  onChange: (name: string | null, paramMap: string[]) => void;
};

function statusVariant(status: string) {
  if (status === 'APPROVED') return 'default' as const;
  if (status === 'REJECTED') return 'destructive' as const;
  return 'secondary' as const;
}

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={statusVariant(status)}>{metaStatusLabel(status)}</Badge>;
}

function lastSyncLabel(templates: MetaTemplateInfo[]) {
  const times = templates.map((item) => new Date(item.syncedAt).getTime()).filter(Number.isFinite);
  if (times.length === 0) return 'Aún no se ha sincronizado.';
  return `Última sincronización: ${new Date(Math.max(...times)).toLocaleString('es-PA', { dateStyle: 'medium', timeStyle: 'short' })}`;
}

export function MetaTemplateSection(props: MetaTemplateSectionProps) {
  const { templates, linkedName, paramMap, mapError, isLoading, isSyncing, onSync, onChange } = props;
  const available = templates.filter((item) => !item.retired);
  const linked = available.find((item) => item.name === linkedName) ?? null;
  const orphan = linkedName && !linked && !isLoading ? linkedName : null;

  const choose = (value: string) => {
    if (value === NONE) return onChange(null, []);
    const next = available.find((item) => item.name === value);
    if (next) onChange(next.name, resizeParamMap(paramMap, next.paramCount));
  };

  return (
    <section className="space-y-3 rounded-lg border bg-muted/20 p-4" aria-label="Plantilla de Meta">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Plantilla de Meta</h3>
          <p className="text-xs text-muted-foreground">Opcional. Se usa para enviar por la API de WhatsApp fuera de la ventana de 24 h.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button type="button" variant="outline" size="sm" onClick={onSync} disabled={isSyncing}>
            <RefreshCw className={isSyncing ? 'mr-2 h-3.5 w-3.5 animate-spin' : 'mr-2 h-3.5 w-3.5'} aria-hidden />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar con Meta'}
          </Button>
          <span className="text-xs text-muted-foreground">{lastSyncLabel(templates)}</span>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="meta-template-select" className="text-xs text-muted-foreground">Plantilla vinculada</Label>
        <Select value={linkedName ?? NONE} onValueChange={choose} disabled={isLoading}>
          <SelectTrigger id="meta-template-select" className="w-full">
            <SelectValue placeholder="Sin plantilla de Meta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sin plantilla de Meta</SelectItem>
            {orphan ? <SelectItem value={orphan} disabled>{`${orphan} (ya no existe en Meta)`}</SelectItem> : null}
            {available.map((item) => (
              <SelectItem key={item.id} value={item.name}>
                <span className="flex items-center gap-2">{item.name} <StatusBadge status={item.status} /></span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {orphan ? <p role="alert" className="text-xs text-destructive">Esta plantilla ya no existe en Meta. Elige otra o quita el vínculo.</p> : null}
      </div>

      {linked ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge status={linked.status} />
            <span>{linked.category}</span>
            <span>·</span>
            <span>{linked.paramCount} {linked.paramCount === 1 ? 'variable' : 'variables'}</span>
          </div>
          {linked.status !== 'APPROVED' ? (
            <p className="text-xs text-muted-foreground">Solo las plantillas aprobadas se pueden enviar.</p>
          ) : null}
          <div className="space-y-1 rounded-md border bg-background p-3 text-sm" data-testid="meta-body">
            {linked.header ? <p className="font-semibold">{linked.header}</p> : null}
            <p className="whitespace-pre-wrap break-words">{linked.body}</p>
            {linked.footer ? <p className="text-xs text-muted-foreground">{linked.footer}</p> : null}
          </div>
          {linked.buttons.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label="Botones de la plantilla">
              {linked.buttons.map((button) => (
                <li key={`${button.type}-${button.text}`} className="rounded-md border bg-background px-3 py-1 text-xs">{button.text}</li>
              ))}
            </ul>
          ) : null}
          {linked.paramCount > 0 ? (
            <MetaParamMapEditor
              paramCount={linked.paramCount}
              value={paramMap}
              error={mapError}
              onChange={(next) => onChange(linked.name, next)}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
