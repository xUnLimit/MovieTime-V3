'use client';

import { useMemo } from 'react';
import { ListFilter } from 'lucide-react';
import { DataTable, defineDataTableColumns } from '@/components/shared/DataTable';
import { TableCard } from '@/components/shared/TableCard';
import { FilterMenu, TableSearch, TableToolbar, type FilterOption } from '@/components/shared/TableToolbar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePedidos } from '@/hooks/use-pedidos';
import { useTableContext } from '@/hooks/use-table-context';
import { useTerceros } from '@/hooks/use-terceros';
import type { Pedido } from '@/modules/orders/contracts';
import { PedidoRowActions } from './PedidoRowActions';
import { PedidoAmount } from './PedidoAmount';
import { PedidoReview } from './PedidoReview';
import { PEDIDO_FILTERS, isClosedPedido, matchesPedidoFilter, pedidoClient, pedidoSearchText, pedidoStage, reservationHint, type PedidoClient, type PedidoFilter } from './pedido-status';

const FILTER_OPTIONS: readonly FilterOption<PedidoFilter>[] = PEDIDO_FILTERS;

function paymentBadge(pedido: Pedido) {
  if (isClosedPedido(pedido) && pedido.receivedAmount === 0) return <StatusBadge>Sin cobro</StatusBadge>;
  const { paymentState, missingAmount, receivedAmount } = pedido;
  const label = paymentState === 'reembolsado' ? 'Devuelto' : paymentState === 'parcialmente_reembolsado' ? 'Dev. parcial' : paymentState === 'exceso' ? 'Exceso'
    : missingAmount === 0 ? 'Confirmado' : receivedAmount > 0 ? 'Parcial' : 'Pendiente';
  return <StatusBadge tone={missingAmount === 0 ? 'success' : 'warning'}>{label}</StatusBadge>;
}

export function PedidosView() {
  const query = usePedidos();
  const terceros = useTerceros();
  const { filter, setFilter, search, setSearch, selection: selectedId, setSelection: setSelectedId } = useTableContext('pedidos');
  const names = useMemo(() => new Map((terceros.data ?? []).map(item => [item.id, `${item.nombre} ${item.apellido}`.trim()])), [terceros.data]);
  const clientOf = (pedido: Pedido): PedidoClient | null => pedidoClient(pedido, names);
  const rows = useMemo(() => (query.data ?? []).filter(item => matchesPedidoFilter(item, filter) && pedidoSearchText(item, pedidoClient(item, names)).includes(search.trim().toLowerCase())), [query.data, filter, search, names]);
  const selected = query.data?.find(item => item.id === selectedId);
  const columns = defineDataTableColumns<Pedido>([
    { key: 'id', header: 'Pedido', width: '28%', render: row => <div className="min-w-0 leading-tight"><p className="truncate font-medium">{row.items.map(item => item.planNombre).join(', ')}</p><p className="truncate text-xs text-muted-foreground">{row.id.slice(0, 8)} · {row.items.length} {row.items.length === 1 ? 'servicio' : 'servicios'}</p></div> },
    { key: 'cliente', header: 'Cliente', width: '20%', hideBelow: 'md', render: row => { const client = clientOf(row); return <div className="min-w-0 leading-tight"><p className="truncate">{client?.name ?? 'Sin cliente'}</p>{client?.phone ? <p className="truncate text-xs tabular-nums text-muted-foreground">+{client.phone}</p> : null}</div>; } },
    { key: 'total', header: 'Total', align: 'center', render: row => <PedidoAmount value={row.total} currency={row.moneda} /> },
    { key: 'paymentState', header: 'Cobro', align: 'center', hideBelow: 'sm', render: row => paymentBadge(row) },
    { key: 'deliveryState', header: 'Entrega', align: 'center', hideBelow: 'md', render: row => <StatusBadge tone={row.deliveryState === 'enviado' ? 'success' : 'info'}>{row.deliveryState === 'enviado' ? 'Acceso enviado' : row.deliveryState === 'asignado' ? 'Asignado' : row.deliveryState === 'parcial' ? 'Parcial' : 'Pendiente'}</StatusBadge> },
    { key: 'estado', header: 'Estado', hideBelow: 'lg', render: row => { const stage = pedidoStage(row); const hint = reservationHint(row); return <div className="min-w-0 leading-tight"><StatusBadge tone={stage.tone}>{stage.label}</StatusBadge>{hint ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p> : null}</div>; } },
  ]);
  return <div className="space-y-4">
    {query.isError ? <div role="alert" className="space-y-2"><p className="text-sm text-danger">No se pudieron cargar los pedidos.</p><Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></div> : null}
    <TableCard title="Pedidos de clientes" description="Cada pedido reúne sus servicios: revisa su cobro y completa su entrega. Cobro, asignación y acceso conservan estados independientes." toolbar={<TableToolbar><TableSearch value={search} onChange={setSearch} placeholder="Buscar por pedido, servicio, cliente o teléfono…" ariaLabel="Buscar pedido" /><FilterMenu icon={ListFilter} ariaLabel="Estado del pedido" value={(PEDIDO_FILTERS.some(item => item.value === filter) ? filter : 'all') as PedidoFilter} options={FILTER_OPTIONS} onChange={setFilter} /></TableToolbar>}><DataTable bare fixedLayout autoPageSize pagination data={rows} columns={columns} loading={query.isLoading} emptyMessage="No hay pedidos en esta vista." actions={row => <PedidoRowActions pedido={row} client={clientOf(row)} onReview={() => setSelectedId(row.id)} />} /></TableCard>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelectedId(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Revisar pedido</DialogTitle><DialogDescription>Comprueba los servicios, el dinero recibido y el siguiente paso de entrega.</DialogDescription></DialogHeader>{selected ? <PedidoReview key={selected.id} pedido={selected} client={clientOf(selected)} /> : null}</DialogContent></Dialog>
  </div>;
}
