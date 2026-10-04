'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, Inbox, ListFilter, Mail, RefreshCw, XCircle } from 'lucide-react';

import { DataTable, defineDataTableColumns } from '@/components/shared/DataTable';
import { MetricCard } from '@/components/shared/MetricCard';
import { MetricGrid } from '@/components/shared/MetricGrid';
import { AutomationNavigation } from '@/components/bot/AutomationNavigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TableCard } from '@/components/shared/TableCard';
import { FilterMenu, TableSearch, TableToolbar } from '@/components/shared/TableToolbar';
import type { Tone } from '@/components/shared/tone';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useYappyActions, useYappyCandidateVentas, useYappyConnections, useYappyPayments, useYappyVentaSearch } from '@/hooks/use-yappy-payments';
import type { YappyCandidateVenta, YappyPayment } from '@/application/use-cases/yappy-use-cases';
import { cn } from '@/platform/utils';
import { useAuthStore } from '@/store/authStore';

const labels: Record<string, string> = {
  match_unico: 'Coincidencia única', ambiguo: 'Varias coincidencias', sin_match: 'Sin coincidencia',
  registrado: 'Registrado', descartado: 'Descartado',
};
const tones: Record<string, Tone> = {
  match_unico: 'success', ambiguo: 'warning', sin_match: 'danger', registrado: 'info', descartado: 'neutral',
};
const filters = ['todos', 'match_unico', 'ambiguo', 'sin_match', 'registrado', 'descartado'] as const;
const CLOSED_STATUSES = ['registrado', 'descartado'];
const money = new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD' });
const panamaDate = new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', dateStyle: 'medium', timeStyle: 'short' });
function maskMailbox(mailbox: string): string {
  const [local, domain] = mailbox.split('@');
  return local && domain ? `${local.slice(0, 2)}***@${domain}` : 'Buzón pendiente';
}

function Candidate({ venta, selected, onSelect, busy }: { venta: YappyCandidateVenta; selected: boolean; onSelect: () => void; busy: boolean }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm', selected ? 'border-primary bg-primary/5' : 'bg-muted/30')}>
      <div className="min-w-0">
        <p className="font-medium">{venta.cliente || 'Cliente sin nombre'} · {venta.servicio || 'Servicio sin nombre'}</p>
        <p className="text-xs text-muted-foreground">{venta.perfil} · Vence {venta.fechaFin} · {money.format(venta.precio)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild><Link href={`/ventas/${venta.id}`}>Renovar en la venta</Link></Button>
        <Button size="sm" variant={selected ? 'secondary' : 'default'} onClick={onSelect} disabled={busy || selected}>{selected ? 'Seleccionada' : 'Seleccionar'}</Button>
      </div>
    </div>
  );
}

function ManualSearch({ payment, selected, onSelect, busy }: { payment: YappyPayment; selected: string; onSelect: (id: string) => void; busy: boolean }) {
  const [search, setSearch] = useState('');
  const manualQuery = useYappyVentaSearch(search, true);
  const manual = manualQuery.data ?? [];
  return (
    <div className="space-y-2">
      <Label htmlFor={`venta-${payment.id}`}>Buscar venta para conciliación manual</Label>
      <Input id={`venta-${payment.id}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cliente, servicio o ID de venta" />
      {manual.map((venta) => <Candidate key={venta.id} venta={venta} selected={selected === venta.id} onSelect={() => onSelect(venta.id)} busy={busy} />)}
      {manualQuery.isFetching && <p className="text-sm text-muted-foreground">Buscando ventas…</p>}
      {manualQuery.isError && <p role="alert" className="text-sm text-danger">No se pudo buscar ventas.</p>}
      {search.trim().length >= 2 && !manualQuery.isFetching && !manualQuery.isError && manual.length === 0 && <p className="text-sm text-muted-foreground">No hay ventas con ese criterio.</p>}
    </div>
  );
}

function PaymentReview({ payment, ventas }: { payment: YappyPayment; ventas: YappyCandidateVenta[] }) {
  const { resolve, dismiss } = useYappyActions();
  const [selected, setSelected] = useState(payment.matchStatus === 'match_unico' ? payment.candidateVentaIds[0] ?? '' : '');
  const [note, setNote] = useState('');
  const [showDismiss, setShowDismiss] = useState(false);
  const suggested = ventas.filter((venta) => payment.candidateVentaIds.includes(venta.id));
  const busy = resolve.isPending || dismiss.isPending;
  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xl font-semibold tabular-nums">{money.format(payment.amount)}</p>
          <p className="text-sm text-muted-foreground">{payment.payerNameShort} · ****-{payment.payerPhoneLast4}</p>
        </div>
        <StatusBadge tone={tones[payment.matchStatus] ?? 'neutral'}>{labels[payment.matchStatus] ?? payment.matchStatus}</StatusBadge>
      </div>
      <p className="text-xs text-muted-foreground">{panamaDate.format(new Date(payment.paidAt))} · Confirmación {payment.confirmationCode}</p>
      <div className="space-y-3 border-t pt-4">
        {suggested.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Ventas candidatas</h2>
            {suggested.map((venta) => <Candidate key={venta.id} venta={venta} selected={selected === venta.id} onSelect={() => setSelected(venta.id)} busy={busy} />)}
          </div>
        )}
        {payment.matchStatus === 'sin_match' && <ManualSearch payment={payment} selected={selected} onSelect={setSelected} busy={busy} />}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setShowDismiss((value) => !value)}>Descartar</Button>
          <Button disabled={!selected || busy} onClick={() => resolve.mutate({ paymentId: payment.id, ventaId: selected })}>Marcar como registrado</Button>
        </div>
        {showDismiss && (
          <div className="space-y-2">
            <Label htmlFor={`motivo-${payment.id}`}>Motivo para descartar</Label>
            <Textarea id={`motivo-${payment.id}`} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={2} />
            <Button variant="destructive" disabled={!note.trim() || busy} onClick={() => dismiss.mutate({ paymentId: payment.id, note })}>Confirmar descarte</Button>
          </div>
        )}
        {(resolve.isError || dismiss.isError) && <p role="alert" className="text-sm text-danger">No se pudo actualizar el pago. Inténtalo de nuevo.</p>}
      </div>
    </article>
  );
}

function MailboxPanel({ connections, sync }: { connections: ReturnType<typeof useYappyConnections>; sync: ReturnType<typeof useYappyActions>['sync'] }) {
  const connection = connections.data?.[0];
  return (
    <Card className="gap-0 px-4 py-3" aria-label="Buzón Gmail">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Mail aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Buzón Gmail</h2>
        {connections.isLoading ? <p className="text-xs text-muted-foreground">Cargando buzón…</p> : connection ? (
          <>
            <p className="text-sm">{maskMailbox(connection.mailbox)}</p>
            <p className="text-xs text-muted-foreground">Última sincronización: {connection.lastSyncedAt ? panamaDate.format(new Date(connection.lastSyncedAt)) : 'Pendiente'}</p>
          </>
        ) : <p className="text-xs text-muted-foreground">Aún no hay estado del buzón.</p>}
        {connection && <StatusBadge className="sm:ml-auto" tone={connection.status === 'configurado' ? 'success' : 'warning'}>{connection.status === 'configurado' ? 'Configurado' : 'Requiere atención'}</StatusBadge>}
      </div>
      {connection?.lastErrorCode === 'auth_failed' && <p role="alert" className="mt-2 text-sm text-danger">Revisa la contraseña de aplicación de Gmail en Vercel.</p>}
      {(connections.isError || sync.isError) && <p role="alert" className="mt-2 text-sm text-danger">No se pudo cargar o sincronizar el buzón.</p>}
      {sync.isSuccess && sync.data?.errorCode === null && <p role="status" className="mt-2 text-sm text-success">Sincronización finalizada.</p>}
      {sync.data?.errorCode === 'sync_error' && <p role="alert" className="mt-2 text-sm text-danger">La sincronización se interrumpió. Inténtalo de nuevo.</p>}
    </Card>
  );
}

interface PaymentRow extends YappyPayment {
  searchText: string;
}

function createColumns(onReview: (payment: YappyPayment) => void) {
  return defineDataTableColumns<PaymentRow>([
    { key: 'amount', header: 'Monto', sortable: true, render: (row) => <span className="whitespace-nowrap font-medium tabular-nums"><span className="text-success">$</span>{row.amount.toFixed(2)}</span> },
    { key: 'payerNameShort', header: 'Pagador', sortable: true, render: (row) => (
      <div className="min-w-0 leading-tight">
        <p className="truncate font-medium">{row.payerNameShort}</p>
        <p className="hidden truncate text-xs text-muted-foreground @min-[30rem]:block">****-{row.payerPhoneLast4}</p>
        <StatusBadge tone={tones[row.matchStatus] ?? 'neutral'} className="mt-0.5 @min-[30rem]:hidden">{labels[row.matchStatus] ?? row.matchStatus}</StatusBadge>
      </div>
    ) },
    { key: 'paidAt', header: 'Fecha', sortable: true, hideBelow: 'sm', render: (row) => <span className="whitespace-nowrap">{panamaDate.format(new Date(row.paidAt))}</span> },
    { key: 'confirmationCode', header: 'Confirmación', hideBelow: 'lg', render: (row) => <span className="tabular-nums">{row.confirmationCode}</span> },
    { key: 'matchStatus', header: 'Estado', hideBelow: 'sm', render: (row) => <StatusBadge tone={tones[row.matchStatus] ?? 'neutral'}>{labels[row.matchStatus] ?? row.matchStatus}</StatusBadge> },
    {
      key: 'acciones',
      header: 'Detalle',
      align: 'center',
      render: (row) => {
        if (!CLOSED_STATUSES.includes(row.matchStatus)) return <Button size="sm" variant="outline" onClick={() => onReview(row)}>Revisar</Button>;
        if (row.matchStatus === 'registrado' && row.matchedVentaId) {
          return <Link className="text-sm text-primary underline-offset-4 hover:underline" href={`/ventas/${row.matchedVentaId}`}>Ver venta registrada</Link>;
        }
        return <span className="text-muted-foreground">—</span>;
      },
    },
  ]);
}

export function YappyPaymentsView() {
  const user = useAuthStore((state) => state.user);
  const payments = useYappyPayments();
  const connections = useYappyConnections();
  const [filter, setFilter] = useState<string>('todos');
  const [search, setSearch] = useState('');
  const [reviewId, setReviewId] = useState<string | null>(null);
  const all = useMemo(() => payments.data ?? [], [payments.data]);
  const rows = useMemo<PaymentRow[]>(() => {
    const query = search.trim().toLowerCase();
    return all
      .filter((payment) => filter === 'todos' || payment.matchStatus === filter)
      .map((payment) => ({ ...payment, searchText: `${payment.payerNameShort} ${payment.confirmationCode} ${payment.payerPhoneLast4}`.toLowerCase() }))
      .filter((row) => !query || row.searchText.includes(query));
  }, [all, filter, search]);
  const reviewing = all.find((payment) => payment.id === reviewId) ?? null;
  const ventas = useYappyCandidateVentas(reviewing?.candidateVentaIds ?? []);
  const { sync } = useYappyActions();
  const columns = useMemo(() => createColumns((payment) => setReviewId(payment.id)), []);
  if (user?.role !== 'admin') return <p className="p-6">Esta sección está disponible solo para administradores.</p>;
  const countBy = (status: string) => all.filter((payment) => payment.matchStatus === status).length;
  const pending = all.filter((payment) => !CLOSED_STATUSES.includes(payment.matchStatus)).length;
  const filterOptions = filters.map((item) => ({
    value: item,
    label: `${item === 'todos' ? 'Todos' : labels[item]} (${item === 'todos' ? all.length : countBy(item)})`,
  }));
  return (
    <div className="space-y-4">
      <PageHeader
        title="Pagos Yappy detectados"
        description="Revisa los pagos recibidos por correo y regístralos en la venta que corresponde."
        actions={
          <Button disabled={sync.isPending} onClick={() => sync.mutate()}>
            <RefreshCw className={cn(sync.isPending && 'animate-spin')} />
            {sync.isPending ? 'Sincronizando…' : 'Sincronizar ahora'}
          </Button>
        }
      />
      <AutomationNavigation />
      <MetricGrid>
        <MetricCard title="Detectados" value={all.length} icon={Inbox} tone="info" loading={payments.isLoading} />
        <MetricCard title="Por revisar" value={pending} icon={Clock} tone="warning" loading={payments.isLoading} />
        <MetricCard title="Registrados" value={countBy('registrado')} icon={CheckCircle2} tone="success" loading={payments.isLoading} />
        <MetricCard title="Descartados" value={countBy('descartado')} icon={XCircle} tone="danger" loading={payments.isLoading} />
      </MetricGrid>
      <MailboxPanel connections={connections} sync={sync} />
      {payments.isLoading && <p role="status" className="sr-only">Cargando pagos…</p>}
      {(payments.isError || ventas.isError) && <p role="alert" className="text-sm text-danger">No se pudo cargar la cola. Actualiza la página.</p>}
      <TableCard
        title="Cola de pagos"
        description="Revisa cada aviso y renueva la venta desde su detalle. La detección no registra cobros automáticamente."
        toolbar={
          <TableToolbar>
            <TableSearch value={search} onChange={setSearch} placeholder="Buscar por pagador o confirmación..." />
            <FilterMenu icon={ListFilter} ariaLabel="Estado" value={filter} options={filterOptions} onChange={setFilter} />
          </TableToolbar>
        }
      >
        <DataTable
          bare
          autoPageSize
          pagination
          data={rows}
          columns={columns}
          loading={payments.isLoading}
          emptyMessage="No hay pagos en este estado."
        />
      </TableCard>
      <Dialog open={reviewing !== null} onOpenChange={(open) => { if (!open) setReviewId(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Revisar pago</DialogTitle>
            <DialogDescription>Elige la venta a la que corresponde el cobro o descártalo.</DialogDescription>
          </DialogHeader>
          {reviewing ? <PaymentReview key={reviewing.id} payment={reviewing} ventas={ventas.data ?? []} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}



