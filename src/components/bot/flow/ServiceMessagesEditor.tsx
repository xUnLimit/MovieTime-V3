'use client';

import { useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Panel } from '@/components/shared/Panel';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TableSearch } from '@/components/shared/TableToolbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useCategoriasFull } from '@/hooks/use-categorias-full';
import {
  CATALOG_MESSAGE_FIELDS, catalogMessageProblem, countCatalogMessages, getCatalogMessage, normalizeText, setCatalogMessage,
  type CatalogField, type CatalogScope,
} from '@/modules/bot-config';
import { COPY_VARIABLES } from '@/modules/commerce-copy/catalog';
import { renderCopyText } from '@/modules/commerce-copy/render';
import type { Categoria } from '@/types';
import type { BotDefinition } from '@/types/bot';
import { MessageBubble } from '../MessageBubble';

type Update = (updater: (current: BotDefinition) => BotDefinition) => void;
type Values = Record<string, string>;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

type FieldProps = { def: BotDefinition; update: Update; scope: CatalogScope; id: string; field: CatalogField; values: Values };

/** Un mensaje propio de una plataforma o de un plan: edición inmediata, datos insertables y lo que verá el cliente. */
function ServiceMessageField({ def, update, scope, id, field, values }: FieldProps) {
  const spec = CATALOG_MESSAGE_FIELDS[scope][field];
  const inputId = useId();
  const input = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  if (!spec) return null;
  const value = getCatalogMessage(def, scope, id, field) ?? '';
  const problem = value.trim() ? catalogMessageProblem(scope, field, value) : null;
  const change = (text: string) => update((current) => setCatalogMessage(current, scope, id, field, text));
  const insert = (name: string) => {
    const marker = `{{${name}}}`;
    const start = input.current?.selectionStart ?? value.length;
    const end = input.current?.selectionEnd ?? value.length;
    change(`${value.slice(0, start)}${marker}${value.slice(end)}`);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + marker.length, start + marker.length); });
  };
  const shown = value.trim() && !problem ? value : spec.fallback;
  return <div className="space-y-2 rounded-md border p-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="leading-tight">
        <label htmlFor={inputId} className="text-sm font-medium">{spec.label}</label>
        <p className="text-xs text-muted-foreground">{spec.when}</p>
      </div>
      {value ? <Button type="button" size="sm" variant="ghost" onClick={() => change('')}>Usar el texto general</Button> : <StatusBadge>Texto general</StatusBadge>}
    </div>
    {spec.multiline
      ? <Textarea id={inputId} ref={input} rows={3} value={value} maxLength={spec.maxLength} placeholder="Déjalo vacío para usar el texto general" aria-invalid={problem !== null} onChange={(event) => change(event.target.value)} />
      : <Input id={inputId} ref={input} value={value} maxLength={spec.maxLength} placeholder="Déjalo vacío para usar el texto general" aria-invalid={problem !== null} onChange={(event) => change(event.target.value)} />}
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span className="tabular-nums">{value.length}/{spec.maxLength} caracteres</span>
      {problem ? <span role="alert" className="text-danger">{problem}</span> : null}
    </div>
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Datos que puedes insertar en ${spec.label}`}>
      {spec.variables.map((name) => <Button key={name} type="button" size="sm" variant="outline" title={`Ejemplo: ${values[name] ?? COPY_VARIABLES[name].example}`} onClick={() => insert(name)}>{COPY_VARIABLES[name].label}</Button>)}
    </div>
    <MessageBubble text={renderCopyText(shown, values)} />
  </div>;
}

function CategoryRow({ def, update, category }: { def: BotDefinition; update: Update; category: Categoria }) {
  const [open, setOpen] = useState(false);
  const plans = category.planes ?? [];
  const count = countCatalogMessages(def, category.id, plans.map((plan) => plan.id));
  const panelId = useId();
  const cheapest = plans.reduce<number | null>((best, plan) => (best === null || plan.precio < best ? plan.precio : best), null);
  const categoryValues: Values = { plataforma: category.nombre, cantidad: String(plans.length), precio: `USD ${(cheapest ?? 0).toFixed(2)}` };
  return <li className="border-t first:border-t-0">
    <Button type="button" variant="ghost" className="h-auto w-full justify-between gap-2 py-2 text-left" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate">{category.nombre}</span>
        <span className="block truncate text-xs font-normal text-muted-foreground">{plans.length} {plans.length === 1 ? 'plan' : 'planes'}</span>
      </span>
      {count > 0 ? <StatusBadge tone="info">{count} {count === 1 ? 'mensaje propio' : 'mensajes propios'}</StatusBadge> : null}
      <ChevronDown aria-hidden className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
    </Button>
    {open ? <div id={panelId} className="space-y-4 border-t px-3 py-3">
      <section aria-label={`Mensajes de la plataforma ${category.nombre}`} className="space-y-2">
        <h4 className="text-sm font-semibold">Plataforma: {category.nombre}</h4>
        <ServiceMessageField def={def} update={update} scope="category" id={category.id} field="chosen" values={categoryValues} />
        <ServiceMessageField def={def} update={update} scope="category" id={category.id} field="rowDescription" values={categoryValues} />
      </section>
      {plans.map((plan) => {
        const values: Values = { plataforma: category.nombre, servicio: `${category.nombre} ${plan.nombre}`.trim(), precio: `USD ${plan.precio.toFixed(2)}`, ciclo: capitalize(plan.cicloPago) };
        return <section key={plan.id} aria-label={`Mensajes del plan ${plan.nombre}`} className="space-y-2">
          <h4 className="text-sm font-semibold">Plan: {plan.nombre} <span className="font-normal text-muted-foreground">· {values.precio} · {values.ciclo}</span></h4>
          <ServiceMessageField def={def} update={update} scope="plan" id={plan.id} field="added" values={values} />
          <ServiceMessageField def={def} update={update} scope="plan" id={plan.id} field="rowDescription" values={values} />
        </section>;
      })}
    </div> : null}
  </li>;
}

/**
 * Mensajes propios de cada plataforma y de cada plan que ofreces: lo que se dice al elegirlos y la línea que los describe en
 * las listas. Lo que se deja vacío usa el texto general de la compra. Se guardan en el borrador y se publican con el bot.
 */
export function ServiceMessagesEditor({ def, update }: { def: BotDefinition; update: Update }) {
  const categories = useCategoriasFull();
  const [query, setQuery] = useState('');
  const active = (categories.data ?? []).filter((category) => category.activo);
  const needle = normalizeText(query);
  const visible = active.filter((category) => !needle || normalizeText(`${category.nombre} ${(category.planes ?? []).map((plan) => plan.nombre).join(' ')}`).includes(needle));
  return <Panel title="Mensajes por servicio" description="Cada plataforma y cada plan puede decir algo distinto al elegirlo y describirse a su manera en las listas. Lo que dejes vacío usa el texto general.">
    {categories.isPending ? <div aria-busy="true" className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><span className="sr-only">Cargando tus servicios</span></div>
      : categories.isError ? <div role="alert" className="space-y-2"><p className="text-sm text-danger">No se pudieron cargar tus plataformas y planes.</p><Button variant="outline" size="sm" onClick={() => void categories.refetch()}>Reintentar</Button></div>
        : active.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay plataformas activas. Créalas en Categorías para poder personalizar sus mensajes.</p>
          : <div className="space-y-3">
            <TableSearch value={query} onChange={setQuery} placeholder="Buscar una plataforma o un plan" ariaLabel="Buscar un servicio" />
            {visible.length === 0 ? <p role="status" className="text-sm text-muted-foreground">Ningún servicio coincide con la búsqueda.</p>
              : <ul aria-label="Servicios" className="rounded-md border">{visible.map((category) => <CategoryRow key={category.id} def={def} update={update} category={category} />)}</ul>}
          </div>}
  </Panel>;
}
