'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { setBlockCopy, setMessage, withPurchaseBlocks } from '@/modules/bot-config';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCommerceCopy } from '@/hooks/use-commerce-copy';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/platform/utils';
import type { BotAdminApi, BotDefinition } from '@/types/bot';
import { BotState } from '../BotState';
import { buildMessageGroups, filterMessageGroups, issuePath, type MessageGroup, type MessageItem } from '../messages/message-items';
import { CopyResponseEditor } from './CopyResponseEditor';
import { ResponseEditor } from './ResponseEditor';

type Filter = 'todos' | 'editados' | 'errores';

/** Los grupos de compra son muchos y largos: se abren solos solo si contienen el texto elegido o hay una búsqueda. */
const FOLDED = (group: MessageGroup) => group.id.startsWith('block:');

function EditorFor({ api, def, item }: { api: BotAdminApi; def: BotDefinition; item: MessageItem }) {
  const stored = useCommerceCopy();
  if (item.kind === 'bot') {
    const issues = api.issues.filter((issue) => issue.path === issuePath(item));
    return <ResponseEditor key={item.id} messageKey={item.key} value={def.messages[item.key] ?? ''} issues={issues}
      onChange={(value) => api.updateDraft((current) => setMessage(current, item.key, value))} />;
  }
  if (stored.isPending) return <div aria-busy="true" className="p-5"><Skeleton className="h-40 w-full" /><span className="sr-only">Cargando los textos de compras</span></div>;
  if (stored.isError) {
    return <div role="alert" className="space-y-2 p-5">
      <p className="text-sm text-danger">No se pudieron leer los textos que el bot usa hoy. Reintenta antes de cambiarlos.</p>
      <Button variant="outline" size="sm" onClick={() => void stored.refetch()}>Reintentar</Button>
    </div>;
  }
  const block = def.nodes.find((node) => node.id === item.nodeId)?.block;
  return <CopyResponseEditor key={item.id} copyKey={item.key} saved={block?.copy[item.key]} inherited={stored.data?.overrides[item.key]}
    onApply={(text) => api.updateDraft((current) => setBlockCopy(withPurchaseBlocks(current), item.nodeId, item.key, text))} />;
}

function GroupList({ groups, selectedId, onSelect, searching, failing }: { groups: readonly MessageGroup[]; selectedId: string; onSelect: (id: string) => void; searching: boolean; failing: ReadonlySet<string> }) {
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  return <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1.5">
    {groups.map((group) => {
      const holdsSelected = group.items.some((item) => item.id === selectedId);
      const open = opened[group.id] ?? (searching || holdsSelected || !FOLDED(group));
      const edited = group.items.filter((item) => item.edited).length;
      return <section key={group.id} aria-label={`Respuestas de ${group.title}`}>
        <button type="button" aria-expanded={open} onClick={() => setOpened({ ...opened, [group.id]: !open })}
          className="flex min-h-8 w-full items-center gap-1.5 rounded-md px-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-10">
          <ChevronRight aria-hidden className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-90')} />
          <span className="min-w-0 flex-1 truncate">{group.title}</span>
          {edited > 0 ? <span className="text-primary-text tabular-nums">{edited} editados</span> : null}
          <span className="tabular-nums">{group.items.length}</span>
        </button>
        {open ? <ul>{group.items.map((item) => <li key={item.id}>
          <button type="button" onClick={() => onSelect(item.id)} aria-current={item.id === selectedId ? 'true' : undefined}
            className={cn('flex min-h-12 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-14', item.id === selectedId && 'bg-accent')}>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium">{item.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.preview || 'Sin texto'}</span>
            </span>
            {failing.has(item.id) ? <StatusBadge tone="danger" className="shrink-0">Error</StatusBadge> : item.edited ? <StatusBadge tone="info" className="shrink-0">Editado</StatusBadge> : null}
          </button>
        </li>)}</ul> : null}
      </section>;
    })}
  </div>;
}

/**
 * Respuestas del bot como lista y editor en una sola superficie (igual que el estudio del recorrido): los grupos se pliegan,
 * se puede ver solo lo editado y el editor muestra el texto junto a cómo lo ve el cliente. En angosto se alternan.
 */
export function ResponsesStudio({ api }: { api: BotAdminApi }) {
  const stored = useCommerceCopy();
  const wide = useMediaQuery('(min-width: 1024px)');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState(false);
  const draft = api.draft;
  const groups = useMemo(() => (draft ? buildMessageGroups(withPurchaseBlocks(draft), stored.data?.overrides ?? {}) : []), [draft, stored.data]);
  const all = groups.flatMap((group) => group.items);
  const edited = all.filter((item) => item.edited).length;
  const failing = useMemo(() => {
    const paths = new Set(api.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.path));
    return new Set(all.filter((item) => paths.has(issuePath(item))).map((item) => item.id));
  }, [api.issues, all]);
  const visible = useMemo(() => filterMessageGroups(groups, query)
    .map((group) => ({ ...group, items: group.items.filter((item) => filter === 'todos' || (filter === 'editados' ? item.edited : failing.has(item.id))) }))
    .filter((group) => group.items.length > 0), [groups, query, filter, failing]);
  const order = visible.flatMap((group) => group.items);
  const selected = all.find((item) => item.id === selectedId) ?? all[0];
  const position = order.findIndex((item) => item.id === selected?.id);
  const go = (offset: number) => { const next = order[position + offset]; if (next) setSelectedId(next.id); };

  const list = <div className="flex min-h-0 flex-1 flex-col">
    <div className="space-y-2 border-b p-3">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8" type="search" aria-label="Buscar un mensaje" placeholder="Buscar un mensaje…" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <Tabs value={filter} onValueChange={(value) => setFilter(value === 'editados' || value === 'errores' ? value : 'todos')}>
        <TabsList variant="pills" aria-label="Filtrar mensajes">
          <TabsTrigger value="todos">Todos · {all.length}</TabsTrigger>
          <TabsTrigger value="editados">Editados · {edited}</TabsTrigger>
          <TabsTrigger value="errores">Con error · {failing.size}</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
    {visible.length === 0
      ? <p role="status" className="p-6 text-center text-sm text-muted-foreground">{query ? 'Ningún mensaje coincide con la búsqueda.' : filter === 'editados' ? 'Todavía no editaste ningún mensaje.' : 'Ningún mensaje tiene errores.'}</p>
      : <GroupList groups={visible} selectedId={selected?.id ?? ''} searching={query.trim() !== ''} failing={failing} onSelect={(id) => { setSelectedId(id); setEditing(true); }} />}
  </div>;

  const pane = draft && selected ? <>
    <div className="min-h-0 flex-1 overflow-y-auto">
      {wide ? null : <div className="border-b p-3"><Button variant="ghost" onClick={() => setEditing(false)}><ArrowLeft />Mensajes</Button></div>}
      <EditorFor api={api} def={draft} item={selected} />
    </div>
    <nav aria-label="Recorrer mensajes" className="flex items-center justify-between gap-2 border-t px-4 py-2">
      <Button type="button" variant="ghost" disabled={position <= 0} onClick={() => go(-1)}><ChevronLeft />Anterior</Button>
      <span className="text-xs text-muted-foreground tabular-nums">{position >= 0 ? `${position + 1} de ${order.length}` : `${order.length} mensajes`}</span>
      <Button type="button" variant="ghost" disabled={position >= order.length - 1} onClick={() => go(1)}>Siguiente<ChevronRight /></Button>
    </nav>
  </> : null;

  return <BotState api={api} empty={!draft}>
    {draft && selected ? <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Lo que el bot contesta dentro de la conversación. Los avisos de vencimiento y otros envíos a clientes se editan en Plantillas de mensajes.</p>
      <section aria-label="Respuestas del bot" className="flex min-h-[34rem] flex-col overflow-hidden rounded-xl border bg-card lg:h-[calc(100dvh-17rem)] lg:grid lg:grid-cols-[20rem_minmax(0,1fr)]">
        {wide || !editing ? <div className="flex min-h-0 flex-col lg:border-r">{list}</div> : null}
        {wide || editing ? <div className="flex min-h-0 flex-col">{pane}</div> : null}
      </section>
    </div> : null}
  </BotState>;
}
