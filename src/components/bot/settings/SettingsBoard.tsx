'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { PARAM_CATALOG, setKeywords, setParam } from '@/modules/bot-config';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { cn } from '@/platform/utils';
import type { BotAdminApi, BotParams } from '@/types/bot';
import { BotState } from '../BotState';
import { ConnectionChecks } from '../studio/ConnectionChecks';
import { KeywordsEditor } from '../studio/KeywordsEditor';
import { VersionsTab } from '../VersionsTab';
import { ParamCard } from './ParamCard';
import { PARAM_GROUPS } from './param-groups';

type SectionId = (typeof PARAM_GROUPS)[number]['id'] | 'conexiones' | 'compras' | 'versiones';
type Section = { id: SectionId; title: string; description: string; params?: readonly (keyof BotParams)[] };

/** Las secciones del índice: los grupos de números, las conexiones, el enlace a Compras y el historial de versiones. */
const SECTIONS: readonly Section[] = [
  ...PARAM_GROUPS,
  { id: 'conexiones', title: 'Conexiones', description: 'Lo que el bot necesita para responder y entregar códigos.' },
  { id: 'compras', title: 'Compras por WhatsApp', description: 'Permitir compras nuevas, los minutos de reserva y las reservas máximas por contacto se configuran en Configuración.' },
  { id: 'versiones', title: 'Versiones', description: 'Cada publicación guarda el recorrido completo. Compara, usa como borrador o restaura una anterior.' },
];

/** Cuántos ajustes del borrador difieren de lo publicado (números y palabras clave), en total o en una sección. */
function pendingChanges(api: BotAdminApi, section?: Section): number {
  const { draft, published } = api;
  if (!draft || !published) return 0;
  const keys = section ? section.params ?? [] : (Object.keys(PARAM_CATALOG) as (keyof BotParams)[]);
  const params = keys.filter((key) => draft.params[key] !== published.params[key]).length;
  const words = (!section || section.id === 'atencion') && JSON.stringify(draft.keywords) !== JSON.stringify(published.keywords) ? 1 : 0;
  return params + words;
}

function Block({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section aria-label={title} className="space-y-3">
    <div><h3 className="text-sm font-semibold">{title}</h3>{description ? <p className="text-xs text-muted-foreground">{description}</p> : null}</div>
    {children}
  </section>;
}

/**
 * Ajustes del bot con un índice a la izquierda (en celular, una fila que se desplaza): cada sección agrupa lo que se decide junto
 * y marca cuántos cambios lleva respecto de lo publicado. Cada número muestra su unidad, su rango, el valor predeterminado y si
 * cambió. Las versiones viven aquí, al final; las reglas de compra, en Configuración.
 */
export function SettingsBoard({ api }: { api: BotAdminApi }) {
  const [id, setId] = useState<SectionId>('atencion');
  const draft = api.draft;
  const section = SECTIONS.find((item) => item.id === id) ?? SECTIONS[0];
  const changes = pendingChanges(api);
  const issueOf = (key: keyof BotParams) => api.issues.find((issue) => issue.severity === 'error' && issue.path === `params.${key}`)?.message;

  const content = (): ReactNode => {
    if (!draft) return null;
    if (section.id === 'versiones') return <VersionsTab api={api} />;
    if (section.id === 'conexiones') return <div className="rounded-xl border bg-card p-4"><ConnectionChecks api={api} /></div>;
    if (section.id === 'compras') {
      return <div className="rounded-xl border bg-card p-4">
        <Button variant="outline" asChild><Link href="/configuracion">Ir a Configuración<ExternalLink /></Link></Button>
      </div>;
    }
    return <>
      <div className="grid gap-3 md:grid-cols-2">
        {(section.params ?? []).map((key) => <ParamCard key={key} paramKey={key} value={draft.params[key] ?? PARAM_CATALOG[key].defaultValue} published={api.published?.params[key]} issue={issueOf(key)}
          onChange={(value) => api.updateDraft((current) => setParam(current, key, value))} />)}
      </div>
      {section.id === 'atencion'
        ? <Block title="Palabras clave" description="Cuando el cliente escribe una de estas palabras, el bot le ofrece el menú.">
          <div className="rounded-xl border bg-card p-4"><KeywordsEditor keywords={draft.keywords} onChange={(words) => api.updateDraft((current) => setKeywords(current, words))} /></div>
        </Block> : null}
    </>;
  };

  return <BotState api={api} empty={!draft}>{draft ? <div className="grid min-w-0 gap-6 pt-2 lg:grid-cols-[14rem_minmax(0,1fr)]">
    <nav aria-label="Secciones de ajustes" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:sticky lg:top-4 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0 lg:pb-0">
      {SECTIONS.map((item) => {
        const count = pendingChanges(api, item);
        const failing = (item.params ?? []).some((key) => issueOf(key) !== undefined);
        return <button key={item.id} type="button" aria-current={item.id === section.id ? 'page' : undefined} onClick={() => setId(item.id)}
          className={cn('flex min-h-8 shrink-0 items-center justify-between gap-2 rounded-md px-2.5 text-left text-sm whitespace-nowrap transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-10',
            item.id === section.id && 'bg-accent font-medium')}>
          {item.title}
          {failing ? <StatusBadge tone="danger">Error</StatusBadge> : count > 0 ? <StatusBadge tone="info" aria-label={`${count} cambios sin publicar`}>{count}</StatusBadge> : null}
        </button>;
      })}
    </nav>
    <div className="min-w-0 space-y-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">{section.title}</h2>
        <p className="text-sm text-muted-foreground">{section.description}</p>
        {section.id !== 'versiones' && section.id !== 'conexiones' && section.id !== 'compras'
          ? <p role="status" className="text-xs text-muted-foreground">{changes === 0 ? 'Los ajustes coinciden con lo publicado.' : `${changes} ${changes === 1 ? 'ajuste cambiado' : 'ajustes cambiados'} sin publicar.`}</p> : null}
      </header>
      {content()}
    </div>
  </div> : null}</BotState>;
}
