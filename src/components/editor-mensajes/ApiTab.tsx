'use client';

import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { suggestButtonActions } from '@/modules/messaging/button-actions';
import {
  isParamMapEmpty,
  metaStatusLabel,
  resizeParamMap,
  suggestParamMap,
  type MetaTemplateInfo,
} from '@/modules/messaging/meta-template-mapping';
import { MetaButtonActions } from './MetaButtonActions';
import { MetaParamMapEditor } from './MetaParamMapEditor';
import type { TemplateFields } from './useTemplateDraft';

const NONE = '__none__';

type ApiTabProps = {
  templates: MetaTemplateInfo[];
  fields: TemplateFields;
  mapError: string | null;
  isLoading: boolean;
  onChange: (changes: Partial<TemplateFields>) => void;
};

function statusVariant(status: string) {
  if (status === 'APPROVED') return 'default' as const;
  if (status === 'REJECTED') return 'destructive' as const;
  return 'secondary' as const;
}

function StatusBadge({ status }: { status: string }) {
  return <Badge variant={statusVariant(status)}>{metaStatusLabel(status)}</Badge>;
}

export function ApiTab({ templates, fields, mapError, isLoading, onChange }: ApiTabProps) {
  const { metaTemplateName, metaParamMap, metaButtonActions } = fields;
  const available = templates.filter((item) => !item.retired);
  const linked = available.find((item) => item.name === metaTemplateName) ?? null;
  const orphan = metaTemplateName && !linked && !isLoading ? metaTemplateName : null;

  const choose = (value: string) => {
    if (value === NONE) return onChange({ metaTemplateName: null, metaParamMap: [], metaButtonActions: [] });
    const next = available.find((item) => item.name === value);
    if (!next) return;
    const map = isParamMapEmpty(metaParamMap) ? suggestParamMap(next.paramCount) : metaParamMap;
    onChange({
      metaTemplateName: next.name,
      metaParamMap: resizeParamMap(map, next.paramCount),
      metaButtonActions: suggestButtonActions(next.buttons),
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Es la plantilla aprobada por Meta que se envía por la API de WhatsApp, incluso fuera de la ventana de 24 h.
        Sin plantilla, el mensaje solo sale por wa.me.
      </p>

      <div className="space-y-1">
        <Label htmlFor="meta-template-select" className="text-sm font-medium">Plantilla vinculada</Label>
        <Select value={metaTemplateName ?? NONE} onValueChange={choose} disabled={isLoading}>
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
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge status={linked.status} />
            <span>{linked.category}</span>
            <span aria-hidden>·</span>
            <span>{linked.paramCount} {linked.paramCount === 1 ? 'variable' : 'variables'}</span>
          </div>
          {linked.status !== 'APPROVED' ? (
            <p className="text-xs text-amber-500">Solo las plantillas aprobadas se pueden enviar por la API.</p>
          ) : null}
          <div className="space-y-1 rounded-md border bg-muted/20 p-3 text-sm" data-testid="meta-body">
            {linked.header ? <p className="font-semibold">{linked.header}</p> : null}
            <p className="whitespace-pre-wrap break-words">{linked.body}</p>
            {linked.footer ? <p className="text-xs text-muted-foreground">{linked.footer}</p> : null}
          </div>
          {linked.paramCount > 0 ? (
            <MetaParamMapEditor
              paramCount={linked.paramCount}
              value={metaParamMap}
              error={mapError}
              onChange={(next) => onChange({ metaParamMap: next })}
            />
          ) : null}
          {linked.buttons.length > 0 ? (
            <MetaButtonActions
              buttons={linked.buttons}
              value={metaButtonActions}
              onChange={(next) => onChange({ metaButtonActions: next })}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
