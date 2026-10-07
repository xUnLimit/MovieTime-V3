'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCustomerReports } from '@/hooks/use-customer-reports';
import type { CustomerReport, ReportUpdate } from '@/platform/validation/customer-reports';
import { PageHeader } from '@/components/shared/PageHeader';
import { MetricCard } from '@/components/shared/MetricCard';
import { MetricGrid } from '@/components/shared/MetricGrid';
import { TableCard } from '@/components/shared/TableCard';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PaginationFooter } from '@/components/shared/PaginationFooter';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const LABELS = { open: 'Abierto', in_progress: 'En atención', resolved: 'Resuelto' } as const;

export function ReportsView({ enabled = true }: { enabled?: boolean }) {
  const [status, setStatus] = useState<ReportUpdate['status']>('open');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CustomerReport | null>(null);
  const { query, change } = useCustomerReports({ status, page }, enabled);
  const rows = query.data?.reports ?? [];
  const total = query.data?.total ?? 0;
  const columns: Column<CustomerReport>[] = [
    { key: 'description', header: 'Problema', width: '50%', render: item => <div className="min-w-0 leading-tight"><p className="truncate font-medium">{item.description}</p><p className="truncate text-xs text-muted-foreground">+{item.wa_id}</p></div> },
    { key: 'created_at', header: 'Recibido', width: '25%', hideBelow: 'md', render: item => <span className="text-xs tabular-nums">{new Date(item.created_at).toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' })}</span> },
    { key: 'status', header: 'Estado', width: '25%', render: item => <StatusBadge tone={item.status === 'resolved' ? 'success' : item.status === 'in_progress' ? 'info' : 'warning'}>{LABELS[item.status]}</StatusBadge> },
  ];
  if (!enabled) return <p className="text-sm text-muted-foreground">Esta sección está disponible solo para administradores.</p>;
  return <div className="min-w-0 space-y-4">
    <PageHeader title="Reportes" />
    <MetricGrid><MetricCard title={`Reportes · ${LABELS[status]}`} value={total} loading={query.isLoading} description="Problemas enviados desde el recorrido de WhatsApp" /></MetricGrid>
    <Tabs value={status} onValueChange={value => { if (value === 'open' || value === 'in_progress' || value === 'resolved') { setStatus(value); setPage(1); } }}>
      <TabsList aria-label="Estados de reportes"><TabsTrigger value="open">Abiertos</TabsTrigger><TabsTrigger value="in_progress">En atención</TabsTrigger><TabsTrigger value="resolved">Resueltos</TabsTrigger></TabsList>
    </Tabs>
    {query.isError ? <div role="alert" className="text-sm text-danger">No se pudieron cargar los reportes. <Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></div> : null}
    {change.isError ? <p role="alert" className="text-sm text-danger">No se pudo actualizar. Actualiza la lista e inténtalo de nuevo.</p> : null}
    <TableCard title="Problemas de clientes" description="Abre un reporte para leer la explicación completa y atender el chat."
      footer={<PaginationFooter page={page} totalPages={Math.ceil(total / 10)} hasPrevious={page > 1} hasMore={page * 10 < total} showPageSize={false} onPrevious={() => setPage(value => value - 1)} onNext={() => setPage(value => value + 1)} />}>
      <DataTable bare fixedLayout data={rows} columns={columns} loading={query.isLoading} emptyMessage="No hay reportes en este estado." actions={item => <Button size="sm" variant="ghost" aria-label={`Ver reporte de +${item.wa_id}`} onClick={() => setSelected(item)}>Ver</Button>} />
    </TableCard>
    <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Reporte de problema</DialogTitle><DialogDescription>Explicación recibida de +{selected?.wa_id}. La conversación conserva los mensajes originales y sus adjuntos.</DialogDescription></DialogHeader>
        {selected ? <p className="text-xs text-muted-foreground">Recibido: {new Date(selected.created_at).toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' })}</p> : null}
        <p className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-sm">{selected?.description}</p>
        {selected ? <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline"><Link href={`/chats?wa=${selected.wa_id}`}>Abrir chat</Link></Button>
          <label className="text-sm font-medium">Estado <select aria-label="Estado del reporte" className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={selected.status} disabled={change.isPending}
            onChange={event => { const next = event.target.value; if (next === 'open' || next === 'in_progress' || next === 'resolved') change.mutate({ id: selected.id, status: next, version: selected.version }, { onSuccess: () => setSelected(null) }); }}>
            {Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
        </div> : null}
      </DialogContent>
    </Dialog>
  </div>;
}
