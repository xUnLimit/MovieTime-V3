'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DataTable, defineDataTableColumns } from '@/components/shared/DataTable';
import { Panel } from '@/components/shared/Panel';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TableCard } from '@/components/shared/TableCard';
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

const columns = defineDataTableColumns<BotEvent>([
  { key: 'createdAt', header: 'Fecha', width: '30%', render: event => <span className="block truncate tabular-nums text-sm">{new Date(event.createdAt).toLocaleString('es-PA')}</span> },
  { key: 'type', header: 'Evento', width: '32%', render: event => <StatusBadge tone={event.type === 'error' || event.type === 'mailbox_unavailable' ? 'danger' : event.type === 'rate_limited' || event.type === 'profile_blocked' ? 'warning' : 'neutral'}>{eventTypes.find(item => item.value === event.type)?.label ?? event.type}</StatusBadge> },
  { key: 'waId', header: 'Cliente', width: '38%', render: event => <div className="min-w-0 leading-tight"><p className="truncate text-sm font-medium">{event.clienteNombre ?? event.waId}</p><p className="truncate text-xs text-muted-foreground">{event.waId}</p></div> },
  { key: 'chat', header: 'Chat', width: '6rem', render: event => <Link className="text-sm font-medium text-primary underline-offset-2 hover:underline" href={`/chats?wa=${encodeURIComponent(event.waId)}`}>Abrir chat</Link> },
]);

export function ActivityTab({ api }: { api: BotAdminApi }) {
  const [filters, setFilters] = useState<BotEventFilters>({});
  const [error, setError] = useState<string | null>(null);
  const events = api.events;
  async function load(page: number, next: BotEventFilters) {
    try { await api.loadEvents(page, next); setError(null); }
    catch { setError('No se pudo cargar la actividad. Inténtalo de nuevo.'); }
  }
  function change(next: BotEventFilters) { setFilters(next); void load(1, next); }
  return <BotState api={api} empty={!events}><div className="space-y-4">
    <ActivityMetrics api={api} />
    {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    <TableCard title="Actividad del bot" description="Eventos recientes sin códigos ni enlaces" toolbar={<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs font-medium">Tipo<select className="h-8 w-full rounded-md border bg-card px-2 text-sm" value={filters.type ?? ''} onChange={event => change({ ...filters, type: event.target.value ? event.target.value as BotEventType : undefined })}><option value="">Todos</option>{eventTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
      <label className="text-xs font-medium">Teléfono<Input value={filters.waId ?? ''} onChange={event => change({ ...filters, waId: event.target.value || undefined })} /></label>
      <label className="text-xs font-medium">Desde<Input type="date" value={filters.from ?? ''} onChange={event => change({ ...filters, from: event.target.value || undefined })} /></label>
      <label className="text-xs font-medium">Hasta<Input type="date" value={filters.to ?? ''} onChange={event => change({ ...filters, to: event.target.value || undefined })} /></label>
    </div>} footer={<div className="flex items-center justify-between gap-2 text-xs"><span>Página {events?.page ?? 1} · {events?.total ?? 0} eventos</span><div className="flex gap-1"><Button size="sm" variant="outline" disabled={!events || events.page <= 1} onClick={() => void load((events?.page ?? 1) - 1, filters)}>Anterior</Button><Button size="sm" variant="outline" disabled={!events || events.page * events.pageSize >= events.total} onClick={() => void load((events?.page ?? 1) + 1, filters)}>Siguiente</Button></div></div>}>
      <DataTable bare fixedLayout data={events?.events.slice(0, 10) ?? []} columns={columns} emptyMessage="No hay eventos para estos filtros" />
    </TableCard>
    {events?.events.length === 0 ? <Panel title="Sin actividad"><p className="text-sm text-muted-foreground">Prueba otros filtros o espera nuevos eventos.</p></Panel> : null}
  </div></BotState>;
}
