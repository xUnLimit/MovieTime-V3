import { Filter } from 'lucide-react';
import { useState } from 'react';
import { TableToolbar, TableSearch, FilterMenu } from '@/components/shared/TableToolbar';
import Link from 'next/link';
import { useCatalogAdmin } from '@/hooks/use-catalog-admin';
import { catalogStock, maskContact } from '@/modules/catalog/admin-contracts';
import { PageHeader } from '@/components/shared/PageHeader';
import { MetricGrid } from '@/components/shared/MetricGrid';
import { MetricCard } from '@/components/shared/MetricCard';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { TableCard } from '@/components/shared/TableCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { CatalogInterest } from '@/platform/supabase/catalog-contracts';

const labels = { esperando: 'Esperando', avisado: 'Avisado', convertido: 'Atendido', descartado: 'Descartado' };
export function InterestView() { return <InterestScreen api={useCatalogAdmin()} />; }

export function InterestScreen({ api }: { api: ReturnType<typeof useCatalogAdmin> }) {
  const { snapshot, interest } = api;
  const data = snapshot.data;
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('all');
  const [status, setStatus] = useState('all');
  const name = (id: string) => data?.categories.find(row => row.id === id)?.nombre ?? 'Plataforma';
  const columns: Column<CatalogInterest>[] = [
    { key: 'contact_id', header: 'Cliente / lead', render: row => {
      const contact = data?.contacts.find(contact => contact.wa_id === row.contact_id);
      const customer = data?.customers.find(customer => customer.id === contact?.tercero_id);
      return <div className="leading-tight"><div className="truncate font-medium">{customer?.nombre || contact?.nombre_perfil || 'Lead'}</div><div className="truncate text-xs text-muted-foreground">{maskContact(row.contact_id)}</div></div>;
    } },
    { key: 'categoria_id', header: 'Plataforma', render: row => <div className="leading-tight"><div className="truncate font-medium">{name(row.categoria_id)}</div><div className="truncate text-xs text-muted-foreground">{data?.plans.find(plan => plan.id === row.plan_id)?.nombre ?? 'Cualquier plan'}</div></div> },
    { key: 'created_at', header: 'Desde', render: row => <span className="text-xs tabular-nums">{new Date(row.created_at).toLocaleDateString('es-PA')}</span> },
    { key: 'estado', header: 'Estado', render: row => <StatusBadge tone={row.estado === 'esperando' ? 'warning' : 'neutral'}>{labels[row.estado]}</StatusBadge> },
  ];
  const waiting = data?.interests.filter(row => row.estado === 'esperando') ?? [];
  const oldest = waiting[0]?.created_at;
  return <div className="flex flex-col gap-3">
    <PageHeader title="Interesados" description="Demanda por plataforma y plan" />
    <MetricGrid><MetricCard title="Personas en espera" value={new Set(waiting.map(row => row.contact_id)).size} loading={snapshot.isLoading} />
      <MetricCard title="Espera más antigua" value={oldest ? new Date(oldest).toLocaleDateString('es-PA') : 'Sin espera'} loading={snapshot.isLoading} />
      {data?.categories.filter(category => waiting.some(row => row.categoria_id === category.id)).map(category => <MetricCard key={category.id} title={category.nombre} value={new Set(waiting.filter(row => row.categoria_id === category.id).map(row => row.contact_id)).size} />)}
    </MetricGrid>
    {data?.demand.map(row => {
      const stock = data.availability.filter(item => item.categoria_id === row.categoria_id && (!row.plan_id || item.plan_id === row.plan_id));
      const count = catalogStock(stock);
      return stock.length > 0 && row.cantidad_esperando > count ? <p key={`${row.categoria_id}:${row.plan_id}`} role="status" className="rounded-md border border-warning-border bg-warning-subtle p-3 text-sm">{row.cantidad_esperando} personas esperan {name(row.categoria_id)}{row.plan_id ? ` ? ${data.plans.find(plan => plan.id === row.plan_id)?.nombre ?? 'Plan'}` : ''}; {count === 0 ? 'no hay perfiles disponibles' : `solo hay ${count} perfiles disponibles`}.</p> : null;
    })}
    {snapshot.isError && <p role="alert" className="text-sm text-danger">No se pudieron cargar los interesados. <Button variant="outline" onClick={() => snapshot.refetch()}>Reintentar</Button></p>}
    {interest.isError && <p role="alert" className="text-sm text-danger">No se pudo actualizar el interés. Reintenta desde la fila.</p>}
    <TableCard toolbar={<TableToolbar><TableSearch value={search} onChange={setSearch} placeholder="Buscar cliente o teléfono" /><FilterMenu icon={Filter} ariaLabel="Plataforma" value={platform} onChange={setPlatform} options={[{ value: 'all', label: 'Todas' }, ...(data?.categories.map(row => ({ value: row.id, label: row.nombre })) ?? [])]} /><FilterMenu icon={Filter} ariaLabel="Estado" value={status} onChange={setStatus} options={[{ value: 'all', label: 'Todos' }, ...Object.entries(labels).map(([value, label]) => ({ value, label }))]} /></TableToolbar>}><DataTable bare fixedLayout pagination itemsPerPageOptions={[10]} rowHeight={49} data={(data?.interests ?? []).filter(row => {
      if (platform !== 'all' && row.categoria_id !== platform || status !== 'all' && row.estado !== status) return false;
      const contact = data?.contacts.find(contact => contact.wa_id === row.contact_id);
      const customer = data?.customers.find(customer => customer.id === contact?.tercero_id);
      return `${customer?.nombre ?? ''} ${contact?.nombre_perfil ?? ''} ${row.contact_id}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'));
    })} columns={columns} loading={snapshot.isLoading} emptyMessage="No hay interesados registrados" actions={row => <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" disabled={interest.isPending} aria-label="Acciones del interesado">Acciones</Button></DropdownMenuTrigger><DropdownMenuContent align="end">
      <DropdownMenuItem asChild><Link href={`/chats?wa=${encodeURIComponent(row.contact_id)}`}>Abrir chat</Link></DropdownMenuItem>
      <DropdownMenuItem disabled={!['esperando', 'avisado'].includes(row.estado)} onSelect={() => interest.mutate({ id: row.id, state: 'convertido' })}>Marcar como atendido</DropdownMenuItem>
      <DropdownMenuItem disabled={!['esperando', 'avisado'].includes(row.estado)} onSelect={() => interest.mutate({ id: row.id, state: 'descartado' })}>Marcar como descartado</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>} /></TableCard>
  </div>;
}
