'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useYappyActions, useYappyCandidateVentas, useYappyConnections, useYappyPayments, useYappyVentaSearch } from '@/hooks/use-yappy-payments';
import type { YappyCandidateVenta, YappyPayment } from '@/application/use-cases/yappy-use-cases';
import { useAuthStore } from '@/store/authStore';

const labels: Record<string, string> = {
  match_unico: 'Coincidencia única', ambiguo: 'Varias coincidencias', sin_match: 'Sin coincidencia',
  registrado: 'Registrado', descartado: 'Descartado',
};
const filters = ['todos', 'match_unico', 'ambiguo', 'sin_match', 'registrado', 'descartado'] as const;
const money = new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD' });
const panamaDate = new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', dateStyle: 'medium', timeStyle: 'short' });
function maskMailbox(mailbox: string): string {
  const [local, domain] = mailbox.split('@');
  return local && domain ? `${local.slice(0, 2)}***@${domain}` : 'Buzón pendiente';
}

function Candidate({ venta, selected, onSelect, busy }: { venta: YappyCandidateVenta; selected: boolean; onSelect: () => void; busy: boolean }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
    <div>
      <p className="font-medium">{venta.cliente || 'Cliente sin nombre'} · {venta.servicio || 'Servicio sin nombre'}</p>
      <p className="text-muted-foreground">{venta.perfil} · Vence {venta.fechaFin} · {money.format(venta.precio)}</p>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" asChild><Link href={`/ventas/${venta.id}`}>Renovar en la venta</Link></Button>
      <Button size="sm" onClick={onSelect} disabled={busy || selected}>{selected ? 'Seleccionada' : 'Seleccionar'}</Button>
    </div>
  </div>;
}

function PaymentCard({ payment, ventas }: { payment: YappyPayment; ventas: YappyCandidateVenta[] }) {
  const { resolve, dismiss } = useYappyActions();
  const [selected, setSelected] = useState(payment.matchStatus === 'match_unico' ? payment.candidateVentaIds[0] ?? '' : '');
  const [search, setSearch] = useState('');
  const manualQuery = useYappyVentaSearch(search, payment.matchStatus === 'sin_match');
  const [note, setNote] = useState('');
  const [showDismiss, setShowDismiss] = useState(false);
  const open = !['registrado', 'descartado'].includes(payment.matchStatus);
  const suggested = ventas.filter((venta) => payment.candidateVentaIds.includes(venta.id));
  const manual = manualQuery.data ?? [];
  const busy = resolve.isPending || dismiss.isPending;
  return <article className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xl font-semibold">{money.format(payment.amount)}</p>
        <p className="text-sm text-muted-foreground">{payment.payerNameShort} · ****-{payment.payerPhoneLast4}</p>
      </div>
      <span className="rounded-full border px-3 py-1 text-xs font-medium">{labels[payment.matchStatus] ?? payment.matchStatus}</span>
    </div>
    <p className="mt-3 text-sm">{panamaDate.format(new Date(payment.paidAt))} · Confirmación {payment.confirmationCode}</p>
    {open && <div className="mt-4 space-y-3">
      {suggested.length > 0 && <div className="space-y-2"><h2 className="text-sm font-semibold">Ventas candidatas</h2>
        {suggested.map((venta) => <Candidate key={venta.id} venta={venta} selected={selected === venta.id} onSelect={() => setSelected(venta.id)} busy={busy} />)}
      </div>}
      {payment.matchStatus === 'sin_match' && <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor={`venta-${payment.id}`}>Buscar venta para conciliación manual</label>
        <input id={`venta-${payment.id}`} value={search} onChange={(event) => setSearch(event.target.value)}
          placeholder="Cliente, servicio o ID de venta" className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        {manual.map((venta) => <Candidate key={venta.id} venta={venta} selected={selected === venta.id} onSelect={() => setSelected(venta.id)} busy={busy} />)}
        {manualQuery.isFetching && <p className="text-sm text-muted-foreground">Buscando ventas…</p>}
        {manualQuery.isError && <p role="alert" className="text-sm text-destructive">No se pudo buscar ventas.</p>}
        {search.trim().length >= 2 && !manualQuery.isFetching && !manualQuery.isError && manual.length === 0 && <p className="text-sm text-muted-foreground">No hay ventas con ese criterio.</p>}
      </div>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={!selected || busy} onClick={() => resolve.mutate({ paymentId: payment.id, ventaId: selected })}>Marcar como registrado</Button>
        <Button variant="outline" disabled={busy} onClick={() => setShowDismiss((value) => !value)}>Descartar</Button>
      </div>
      {showDismiss && <div className="space-y-2">
        <label htmlFor={`motivo-${payment.id}`} className="block text-sm font-medium">Motivo para descartar</label>
        <textarea id={`motivo-${payment.id}`} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm" rows={2} />
        <Button variant="destructive" disabled={!note.trim() || busy} onClick={() => dismiss.mutate({ paymentId: payment.id, note })}>Confirmar descarte</Button>
      </div>}
      {(resolve.isError || dismiss.isError) && <p role="alert" className="text-sm text-destructive">No se pudo actualizar el pago. Inténtalo de nuevo.</p>}
    </div>}
    {payment.matchStatus === 'registrado' && payment.matchedVentaId && <Link className="mt-3 inline-block text-sm underline" href={`/ventas/${payment.matchedVentaId}`}>Ver venta registrada</Link>}
  </article>;
}

function YappyPageContent() {
  const user = useAuthStore((state) => state.user);
  const payments = useYappyPayments();
  const connections = useYappyConnections();
  const [filter, setFilter] = useState<string>('todos');
  const visible = useMemo(() => (payments.data ?? []).filter((payment) => filter === 'todos' || payment.matchStatus === filter), [payments.data, filter]);
  const ventas = useYappyCandidateVentas(visible.flatMap((payment) => payment.candidateVentaIds));
  const { sync } = useYappyActions();
  if (user?.role !== 'admin') return <p className="p-6">Esta sección está disponible solo para administradores.</p>;
  const connection = connections.data?.[0];
  return <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
    <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Pagos Yappy detectados</h1>
      <p className="text-sm text-muted-foreground">Revisa cada aviso y renueva la venta desde su detalle. La detección no registra cobros automáticamente.</p></div>
    <section className="rounded-xl border bg-card p-4 sm:p-5" aria-label="Buzón Gmail">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="font-semibold">Buzón Gmail</h2>
          {connections.isLoading ? <p className="text-sm text-muted-foreground">Cargando buzón…</p> : connection ? <>
            <p className="text-sm">{maskMailbox(connection.mailbox)} · {connection.status === 'configurado' ? 'Configurado' : 'Requiere atención'}</p>
            <p className="text-xs text-muted-foreground">Última sincronización: {connection.lastSyncedAt ? panamaDate.format(new Date(connection.lastSyncedAt)) : 'Pendiente'}</p>
          </> : <p className="text-sm text-muted-foreground">Aún no hay estado del buzón.</p>}
        </div>
        <Button disabled={sync.isPending} onClick={() => sync.mutate()}>{sync.isPending ? 'Sincronizando…' : 'Sincronizar ahora'}</Button>
      </div>
      {connection?.lastErrorCode === 'auth_failed' && <p role="alert" className="mt-2 text-sm text-destructive">Revisa la contraseña de aplicación de Gmail en Vercel.</p>}
      {(connections.isError || sync.isError) && <p role="alert" className="mt-2 text-sm text-destructive">No se pudo cargar o sincronizar el buzón.</p>}
      {sync.isSuccess && sync.data?.errorCode === null && <p role="status" className="mt-2 text-sm">Sincronización finalizada.</p>}
      {sync.data?.errorCode === 'sync_error' && <p role="alert" className="mt-2 text-sm text-destructive">La sincronización se interrumpió. Inténtalo de nuevo.</p>}
    </section>
    <section className="space-y-4" aria-label="Cola de pagos">
      <div className="flex flex-wrap gap-2">{filters.map((item) => <Button key={item} size="sm" variant={filter === item ? 'default' : 'outline'}
        onClick={() => setFilter(item)}>{item === 'todos' ? 'Todos' : labels[item]} ({item === 'todos' ? payments.data?.length ?? 0 : payments.data?.filter((payment) => payment.matchStatus === item).length ?? 0})</Button>)}</div>
      {payments.isLoading && <p role="status" className="text-sm text-muted-foreground">Cargando pagos…</p>}
      {(payments.isError || ventas.isError) && <p role="alert" className="text-sm text-destructive">No se pudo cargar la cola. Actualiza la página.</p>}
      {!payments.isLoading && !payments.isError && visible.length === 0 && <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">No hay pagos en este estado.</p>}
      {visible.map((payment) => <PaymentCard key={payment.id} payment={payment} ventas={ventas.data ?? []} />)}
    </section>
  </main>;
}

export default function YappyPage() { return <YappyPageContent />; }
