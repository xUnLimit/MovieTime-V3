'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ListFilter, MessageSquare } from 'lucide-react';
import { DataTable, defineDataTableColumns } from '@/components/shared/DataTable';
import { PaginationFooter } from '@/components/shared/PaginationFooter';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TableCard } from '@/components/shared/TableCard';
import { FilterMenu, TableSearch, TableToolbar, type FilterOption } from '@/components/shared/TableToolbar';
import type { Tone } from '@/components/shared/tone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BotAdminApi, BotEvent, BotEventFilters, BotEventType } from '@/types/bot';
import { ActivityMetrics } from './ActivityMetrics';
import { BotState } from './BotState';

const eventTypes: { value: BotEventType; label: string }[] = [
  { value: 'menu_shown', label: 'Menú mostrado' }, { value: 'option_selected', label: 'Opción elegida' },
  { value: 'code_sent', label: 'Código entregado' }, { value: 'link_sent', label: 'Enlace entregado' },
  { value: 'not_found', label: 'No encontrado' }, { value: 'already_sent', label: 'Ya entregado' },
  { value: 'profile_blocked', label: 'Perfil bloqueado' }, { value: 'rate_limited', label: 'Límite alcanzado' },
  { value: 'mailbox_unavailable', label: 'Buzón no disponible' }, { value: 'handoff', label: 'Atención humana' },
  { value: 'option_unavailable', label: 'Opción no disponible' }, { value: 'error', label: 'Error' },
];
const TYPE_OPTIONS: readonly FilterOption<BotEventType | 'all'>[] = [{ value: 'all', label: 'Todos los eventos' }, ...eventTypes];
const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 350;

const eventTone = (type: BotEventType): Tone => (type === 'error' || type === 'mailbox_unavailable' ? 'danger' : type === 'rate_limited' || type === 'profile_blocked' ? 'warning' : 'neutral');

const columns = defineDataTableColumns<BotEvent>([
  { key: 'createdAt', header: 'Fecha', width: '26%', render: event => <div className="min-w-0 leading-tight"><p className="truncate text-sm tabular-nums">{new Date(event.createdAt).toLocaleDateString('es-PA', { dateStyle: 'medium' })}</p><p className="truncate text-xs text-muted-foreground tabular-nums">{new Date(event.createdAt).toLocaleTimeString('es-PA', { timeStyle: 'short' })}</p></div> },
  { key: 'type', header: 'Evento', width: '30%', render: event => <StatusBadge tone={eventTone(event.type)}>{eventTypes.find(item => item.value === event.type)?.label ?? event.type}</StatusBadge> },
  { key: 'waId', header: 'Cliente', width: '44%', render: event => <div className="min-w-0 leading-tight"><p className="truncate text-sm font-medium">{event.clienteNombre ?? event.waId}</p><p className="truncate text-xs text-muted-foreground tabular-nums">{event.waId}</p></div> },
]);

type Draft = { type: BotEventType | 'all'; phone: string; from: string; to: string };
const EMPTY: Draft = { type: 'all', phone: '', from: '', to: '' };

/** Fechas del filtro como instantes: «hasta» incluye todo ese día en la hora local. */
function toFilters(draft: Draft): BotEventFilters {
  return {
    type: draft.type === 'all' ? undefined : draft.type, waId: draft.phone.trim() || undefined,
    from: draft.from ? new Date(`${draft.from}T00:00:00`).toISOString() : undefined,
    to: draft.to ? new Date(`${draft.to}T23:59:59.999`).toISOString() : undefined,
  };
}

/** Indicadores y tabla de eventos del bot con el molde estándar: búsqueda, filtros, 10 filas y paginación del servidor. */
export function ActivityTab({ api }: { api: BotAdminApi }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const events = api.events;
  const filtered = draft.type !== 'all' || draft.phone !== '' || draft.from !== '' || draft.to !== '';
  const totalPages = Math.max(1, Math.ceil((events?.total ?? 0) / (events?.pageSize ?? PAGE_SIZE)));

  async function load(page: number, next: Draft) {
    setLoading(true);
    try { await api.loadEvents(page, toFilters(next)); setError(null); }
    catch { setError('No se pudo cargar la actividad. Inténtalo de nuevo.'); }
    finally { setLoading(false); }
  }
  function change(next: Draft, delay = 0) {
    setDraft(next);
    clearTimeout(timer.current);
    if (delay === 0) void load(1, next);
    else timer.current = setTimeout(() => void load(1, next), delay);
  }

  return <BotState api={api} empty={!events}><div className="space-y-4">
    <ActivityMetrics api={api} />
    {error ? <div role="alert" className="flex flex-wrap items-center gap-2"><p className="text-sm text-danger">{error}</p><Button variant="outline" size="sm" onClick={() => void load(events?.page ?? 1, draft)}>Reintentar</Button></div> : null}
    <TableCard title="Actividad del bot" description="Eventos recientes sin códigos ni enlaces"
      toolbar={<TableToolbar actions={filtered ? <Button variant="ghost" onClick={() => change(EMPTY)}>Limpiar filtros</Button> : undefined}>
        <TableSearch value={draft.phone} onChange={phone => change({ ...draft, phone }, SEARCH_DELAY_MS)} placeholder="Buscar por teléfono…" ariaLabel="Teléfono" />
        <FilterMenu icon={ListFilter} ariaLabel="Tipo de evento" value={draft.type} options={TYPE_OPTIONS} onChange={type => change({ ...draft, type })} />
        <Input type="date" aria-label="Desde" className="w-full sm:w-40" value={draft.from} max={draft.to || undefined} onChange={event => change({ ...draft, from: event.target.value })} />
        <Input type="date" aria-label="Hasta" className="w-full sm:w-40" value={draft.to} min={draft.from || undefined} onChange={event => change({ ...draft, to: event.target.value })} />
      </TableToolbar>}
      footer={events && events.total > 0 ? <PaginationFooter className="p-0" showPageSize={false} page={events.page} totalPages={totalPages}
        hasPrevious={events.page > 1} hasMore={events.page < totalPages} onPrevious={() => void load(events.page - 1, draft)} onNext={() => void load(events.page + 1, draft)} /> : undefined}>
      <DataTable bare fixedLayout pagination={false} data={events?.events.slice(0, PAGE_SIZE) ?? []} columns={columns} loading={loading}
        emptyMessage={filtered ? 'No hay eventos para estos filtros.' : 'Todavía no hay actividad del bot.'}
        actions={event => <Button variant="ghost" size="icon-sm" asChild><Link href={`/chats?wa=${encodeURIComponent(event.waId)}`} aria-label="Abrir chat" title="Abrir chat"><MessageSquare /></Link></Button>} />
    </TableCard>
  </div></BotState>;
}
