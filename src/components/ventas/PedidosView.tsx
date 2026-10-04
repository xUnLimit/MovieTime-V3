'use client';

import { useMemo } from 'react';
import { Eye, ListFilter } from 'lucide-react';
import { DataTable, defineDataTableColumns } from '@/components/shared/DataTable';
import { TableCard } from '@/components/shared/TableCard';
import { FilterMenu, TableSearch, TableToolbar } from '@/components/shared/TableToolbar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePedidos } from '@/hooks/use-pedidos';
import { useTableContext } from '@/hooks/use-table-context';
import type { Pedido } from '@/modules/orders/contracts';
import { PedidoAmount, PedidoReview } from './PedidoReview';

export function PedidosView() {
  const query = usePedidos();
  const { filter, setFilter, search, setSearch, selection: selectedId, setSelection: setSelectedId } = useTableContext('pedidos');
  const rows = useMemo(() => (query.data ?? []).filter(item => (filter === 'all' || (filter === 'payment' ? item.missingAmount > 0 : filter === 'delivery' ? item.deliveryState !== 'enviado' : item.deliveryState === 'enviado')) && `${item.id} ${item.items.map(part => part.planNombre).join(' ')}`.toLowerCase().includes(search.toLowerCase())), [query.data, filter, search]);
  const selected = query.data?.find(item => item.id === selectedId);
  const columns = defineDataTableColumns<Pedido>([
    { key: 'id', header: 'Pedido', render: row => <div className="min-w-0 leading-tight"><p className="truncate font-medium">{row.items.map(item => item.planNombre).join(', ')}</p><p className="truncate text-xs text-muted-foreground">{row.id.slice(0, 8)} · {row.items.length} servicios</p></div> },
    { key: 'total', header: 'Total', width: '90px', render: row => <PedidoAmount value={row.total} currency={row.moneda} /> },
    { key: 'paymentState', header: 'Cobro', width: '130px', hideBelow: 'sm', render: row => <StatusBadge tone={row.missingAmount === 0 ? 'success' : 'warning'}>{row.paymentState === 'reembolsado' ? 'Devuelto' : row.paymentState === 'parcialmente_reembolsado' ? 'Dev. parcial' : row.paymentState === 'exceso' ? 'Exceso' : row.missingAmount === 0 ? 'Confirmado' : row.receivedAmount > 0 ? 'Parcial' : 'Pendiente'}</StatusBadge> },
    { key: 'deliveryState', header: 'Entrega', width: '150px', hideBelow: 'md', render: row => <StatusBadge tone={row.deliveryState === 'enviado' ? 'success' : 'info'}>{row.deliveryState === 'enviado' ? 'Acceso enviado' : row.deliveryState === 'asignado' ? 'Asignado' : row.deliveryState === 'parcial' ? 'Parcial' : 'Pendiente'}</StatusBadge> },
  ]);
  return <div className="space-y-4">
    {query.isError ? <div role="alert" className="space-y-2"><p className="text-sm text-danger">No se pudieron cargar los pedidos.</p><Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></div> : null}
    <TableCard title="Pedidos" description="Cada pedido reúne sus servicios. Cobro, asignación y acceso conservan estados independientes." toolbar={<TableToolbar><TableSearch value={search} onChange={setSearch} placeholder="Buscar pedido o servicio…" /><FilterMenu icon={ListFilter} ariaLabel="Estado del pedido" value={filter} options={[{ value: 'all', label: 'Todos' }, { value: 'payment', label: 'Cobro pendiente' }, { value: 'delivery', label: 'Entrega pendiente' }, { value: 'complete', label: 'Completados' }]} onChange={setFilter} /></TableToolbar>}><DataTable bare fixedLayout autoPageSize pagination data={rows} columns={columns} loading={query.isLoading} emptyMessage="No hay pedidos en esta vista." actions={row => <Button variant="ghost" size="icon-sm" aria-label="Revisar" title="Revisar pedido" onClick={() => setSelectedId(row.id)}><Eye /></Button>} /></TableCard>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelectedId(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Revisar pedido</DialogTitle><DialogDescription>Comprueba los servicios, el dinero recibido y el siguiente paso de entrega.</DialogDescription></DialogHeader>{selected ? <PedidoReview key={selected.id} pedido={selected} /> : null}</DialogContent></Dialog>
  </div>;
}

