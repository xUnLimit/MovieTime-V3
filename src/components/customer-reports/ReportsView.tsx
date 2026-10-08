'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, CheckCircle2, CircleDot, Clock3, Copy, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomerReports } from '@/hooks/use-customer-reports';
import { useCustomerReportsRealtime } from '@/hooks/use-customer-reports-realtime';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { openWhatsApp } from '@/platform/utils/whatsapp';

const LABELS = { open: 'Abiertos', in_progress: 'En atención', resolved: 'Resueltos' } as const;
const STATUS_META = {
  open: { icon: CircleDot, tone: 'warning' as const, description: 'Pendientes de revisar' },
  in_progress: { icon: Clock3, tone: 'info' as const, description: 'En proceso de atención' },
  resolved: { icon: CheckCircle2, tone: 'success' as const, description: 'Solucionados' },
} as const;
const RESOLUTION_TEMPLATE = 'Hola, te confirmamos que el inconveniente que nos reportaste ya fue resuelto. Por favor, intenta nuevamente y cuéntanos si todo funciona correctamente. ¡Gracias por tu paciencia!';

function formatDate(date: string) {
  return new Date(date).toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'medium', timeStyle: 'short' });
}

export function ReportsView({ enabled = true, liveUpdates = true }: { enabled?: boolean; liveUpdates?: boolean }) {
  const [status, setStatus] = useState<ReportUpdate['status']>('open');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CustomerReport | null>(null);
  const [message, setMessage] = useState('');
  const [copying, setCopying] = useState(false);
  const refreshInterval = useCustomerReportsRealtime(enabled && liveUpdates);
  const polling = liveUpdates ? refreshInterval : false;
  const { query, change } = useCustomerReports({ status, page }, enabled, polling);
  const openQuery = useCustomerReports({ status: 'open', page: 1 }, enabled, polling).query;
  const inProgressQuery = useCustomerReports({ status: 'in_progress', page: 1 }, enabled, polling).query;
  const resolvedQuery = useCustomerReports({ status: 'resolved', page: 1 }, enabled, polling).query;
  const rows = query.data?.reports ?? [];
  const total = query.data?.total ?? 0;
  const statusTotals = {
    open: openQuery.data?.total ?? 0,
    in_progress: inProgressQuery.data?.total ?? 0,
    resolved: resolvedQuery.data?.total ?? 0,
  };
  const metricsLoading = openQuery.isLoading || inProgressQuery.isLoading || resolvedQuery.isLoading;
  const columns: Column<CustomerReport>[] = [
    { key: 'description', header: 'Problema', width: '50%', render: item => <div className="min-w-0 leading-tight"><p className="truncate font-medium">{item.description}</p><p className="truncate text-xs text-muted-foreground">+{item.wa_id}</p></div> },
    { key: 'created_at', header: 'Recibido', width: '25%', hideBelow: 'md', render: item => <span className="text-xs tabular-nums">{formatDate(item.created_at)}</span> },
    { key: 'status', header: 'Estado', width: '25%', render: item => <StatusBadge tone={STATUS_META[item.status].tone}>{LABELS[item.status].replace(/s$/, '')}</StatusBadge> },
  ];
  if (!enabled) return <p className="text-sm text-muted-foreground">Esta sección está disponible solo para administradores.</p>;

  const selectReport = (report: CustomerReport) => {
    setSelected(report);
    setMessage(report.status === 'resolved' ? RESOLUTION_TEMPLATE : '');
  };

  return <div className="min-w-0 space-y-4 overflow-x-hidden">
    <PageHeader title="Reportes" />
    <MetricGrid>
      {(['open', 'in_progress', 'resolved'] as const).map(key => {
        const Icon = STATUS_META[key].icon;
        return <MetricCard key={key} title={LABELS[key]} value={statusTotals[key]} icon={Icon} tone={STATUS_META[key].tone} loading={metricsLoading} />;
      })}
    </MetricGrid>
    <Tabs className="min-w-0" value={status} onValueChange={value => { if (value === 'open' || value === 'in_progress' || value === 'resolved') { setStatus(value); setPage(1); } }}>
      <TabsList aria-label="Estados de reportes">
        {(['open', 'in_progress', 'resolved'] as const).map(key => <TabsTrigger key={key} value={key}>
          {LABELS[key]}{statusTotals[key] > 0 ? <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.5 text-xs text-danger-foreground sm:ml-2 sm:px-2" aria-label={`${statusTotals[key]} ${LABELS[key].toLowerCase()}`}>{statusTotals[key]}</span> : null}
        </TabsTrigger>)}
      </TabsList>
    <TabsContent value={status} className="min-w-0 space-y-4">
    {query.isError ? <div role="alert" className="text-sm text-danger">No se pudieron cargar los reportes. <Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></div> : null}
    {change.isError ? <p role="alert" className="text-sm text-danger">No se pudo actualizar. Actualiza la lista e inténtalo de nuevo.</p> : null}
    <TableCard title="Problemas de clientes"
      footer={!query.isLoading && rows.length > 0 ? <PaginationFooter className="p-0" page={page} totalPages={Math.ceil(total / 10)} hasPrevious={page > 1} hasMore={page * 10 < total} showPageSize={false} onPrevious={() => setPage(value => value - 1)} onNext={() => setPage(value => value + 1)} /> : undefined}>
      <DataTable bare fixedLayout data={rows} columns={columns} loading={query.isLoading} emptyMessage={`No hay reportes ${LABELS[status].toLowerCase()} por ahora.`} actions={item => <Button size="sm" variant="ghost" aria-label={`Ver reporte de +${item.wa_id}`} onClick={() => selectReport(item)}>Ver</Button>} />
    </TableCard>
    </TabsContent>
    </Tabs>
    <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Detalle del reporte</DialogTitle><DialogDescription>Recibido de +{selected?.wa_id}. Consulta el problema y gestiona su seguimiento.</DialogDescription></DialogHeader>
        {selected ? <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge tone={STATUS_META[selected.status].tone}>{LABELS[selected.status].replace(/s$/, '')}</StatusBadge><span className="text-xs text-muted-foreground">{formatDate(selected.created_at)}</span></div>
          <section className="space-y-1.5"><h3 className="text-sm font-medium">Descripción del problema</h3><p className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 text-sm">{selected.description}</p></section>
          <div className="flex flex-wrap items-end gap-3">
            <Button asChild variant="outline"><Link href={`/chats?wa=${selected.wa_id}`}><MessageCircle aria-hidden />Abrir chat</Link></Button>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">Estado<select aria-label="Estado del reporte" className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground" value={selected.status} disabled={change.isPending}
              onChange={event => { const next = event.target.value; if (next === 'open' || next === 'in_progress' || next === 'resolved') { if (next === 'resolved') setMessage(RESOLUTION_TEMPLATE); change.mutate({ id: selected.id, status: next, version: selected.version }, { onSuccess: () => { setSelected(current => current ? { ...current, status: next, version: current.version + 1 } : null); } }); } }}>
              {Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
          </div>
          {selected.status === 'resolved' ? <section className="space-y-3 rounded-xl border bg-card p-4" aria-label="Aviso de resolución">
            <div><div className="flex items-center gap-2"><CheckCircle2 aria-hidden className="size-4 text-success" /><h3 className="text-sm font-semibold">Avisar al cliente</h3></div><p className="mt-1 text-xs text-muted-foreground">Plantilla lista para revisar y enviar por WhatsApp.</p></div>
            <label className="grid gap-1.5 text-sm font-medium">Mensaje<textarea aria-label="Mensaje de resolución" className="min-h-28 resize-y rounded-md border border-input bg-background p-3 text-sm font-normal" value={message} onChange={event => setMessage(event.target.value)} /></label>
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={copying || !message} onClick={() => { setCopying(true); void navigator.clipboard.writeText(message).then(() => toast.success('Mensaje copiado')).catch(() => toast.error('No se pudo copiar el mensaje')).finally(() => setCopying(false)); }}>{copying ? <Check aria-hidden /> : <Copy aria-hidden />}{copying ? 'Copiando…' : 'Copiar mensaje'}</Button><Button size="sm" disabled={!message} onClick={() => openWhatsApp(selected.wa_id, message)}><Send aria-hidden />Abrir WhatsApp</Button></div>
          </section> : null}
        </div> : null}
      </DialogContent>
    </Dialog>
  </div>;
}
