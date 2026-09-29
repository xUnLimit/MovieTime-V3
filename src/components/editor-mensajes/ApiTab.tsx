'use client';

import { Fragment } from 'react';

import { StatusBadge as ToneBadge } from '@/components/shared/StatusBadge';
import type { Tone } from '@/components/shared/tone';
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

function statusTone(status: string): Tone {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'danger';
  return 'warning';
}

function StatusBadge({ status }: { status: string }) {
  return <ToneBadge tone={statusTone(status)}>{metaStatusLabel(status)}</ToneBadge>;
}

/** Vista "Automatico" del editor: plantilla de Meta, dato de cada variable y accion de cada boton. */
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

  const picker = (
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
  );

  if (!linked) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <h3 className="text-base font-semibold">Este mensaje se envía a mano</h3>
        <p className="max-w-[36ch] text-xs text-muted-foreground">
          Vincula una plantilla aprobada por Meta para que salga sola, incluso fuera de la ventana de 24 h.
        </p>
        <div className="w-full max-w-xs space-y-1.5 text-left">
          <Label htmlFor="meta-template-select" className="text-sm font-medium">Plantilla vinculada</Label>
          {picker}
          {orphan ? <p role="alert" className="text-xs text-danger">Esta plantilla ya no existe en Meta. Elige otra o quita el vínculo.</p> : null}
        </div>
      </div>
    );
  }

  return (
    <Fragment>
      <section aria-label="Plantilla de Meta" className="space-y-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="meta-template-select" className="text-sm font-medium">Plantilla vinculada</Label>
          {picker}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <StatusBadge status={linked.status} />
          <span>{linked.category}</span>
          <span aria-hidden>·</span>
          <span>{linked.paramCount} {linked.paramCount === 1 ? 'variable' : 'variables'}</span>
        </div>
        {linked.status !== 'APPROVED' ? (
          <p className="text-xs text-warning">Solo las plantillas aprobadas se pueden enviar por la API.</p>
        ) : null}
        <div className="space-y-1 rounded-md bg-muted/40 px-3 py-2.5 text-sm" data-testid="meta-body">
          {linked.header ? <p className="font-semibold">{linked.header}</p> : null}
          <p className="whitespace-pre-wrap break-words">{linked.body}</p>
          {linked.footer ? <p className="text-xs text-muted-foreground">{linked.footer}</p> : null}
        </div>
      </section>
      {linked.paramCount > 0 ? (
        <section aria-label="Variables" className="p-4">
          <MetaParamMapEditor
            paramCount={linked.paramCount}
            value={metaParamMap}
            error={mapError}
            onChange={(next) => onChange({ metaParamMap: next })}
          />
        </section>
      ) : null}
      {linked.buttons.length > 0 ? (
        <section aria-label="Botones" className="p-4">
          <MetaButtonActions
            buttons={linked.buttons}
            value={metaButtonActions}
            onChange={(next) => onChange({ metaButtonActions: next })}
          />
        </section>
      ) : null}
    </Fragment>
  );
}
