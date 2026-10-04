'use client';

import { useMemo, useState } from 'react';
import { ListFilter, MoreHorizontal } from 'lucide-react';
import { DataTable, defineDataTableColumns } from '@/components/shared/DataTable';
import { TableCard } from '@/components/shared/TableCard';
import { FilterMenu, TableSearch, TableToolbar } from '@/components/shared/TableToolbar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAutomationControl, useAutomationControlActions } from '@/hooks/use-automation-control';
import { useTableContext } from '@/hooks/use-table-context';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import type { AutomationControl } from '@/types/automation-control';

type Interest = AutomationControl['interests'][number];
const states: Record<string, string> = { waiting: 'En espera', notified: 'Avisado', cancelled: 'Cancelado', fulfilled: 'Completado', invited: 'Invitado', pendiente: 'En espera' };

export function InterestsView() {
  const query = useAutomationControl();
  const { interest } = useAutomationControlActions();
  const { filter, setFilter, search, setSearch } = useTableContext('interesados');
  const [cancel, setCancel] = useState<Interest | null>(null);
  const [notice, setNotice] = useState('');
  const act = (item: Interest, action: 'pause' | 'resume' | 'cancel' | 'notify') => {
    setNotice('');
    interest.mutate({ id: item.id, action }, { onSuccess: () => { setCancel(null); setNotice(action === 'notify' ? 'Aviso preparado. Puedes seguir su entrega desde Chats.' : action === 'pause' ? 'Avisos pausados.' : action === 'resume' ? 'Interés reactivado.' : 'Interés cancelado.'); } });
  };
  const rows = useMemo(() => (query.data?.interests ?? []).filter(item => (filter === 'all' || (filter === 'eligible' ? item.consent && !item.paused && !['cancelled', 'fulfilled'].includes(item.state) : filter === 'paused' ? item.paused : !item.consent)) && `${item.category} ${item.plan} ${item.contactSuffix}`.toLowerCase().includes(search.toLowerCase())), [query.data, filter, search]);
  const columns = defineDataTableColumns<Interest>([
    { key: 'plan', header: 'Servicio', render: row => <div className="min-w-0 leading-tight"><p className="truncate font-medium">{row.plan || row.category}</p><p className="truncate text-xs text-muted-foreground">{row.category}</p></div> },
    { key: 'contactSuffix', header: 'Contacto', width: '100px', hideBelow: 'sm', render: row => <span className="tabular-nums">•••• {row.contactSuffix}</span> },
    { key: 'consent', header: 'Aviso', width: '160px', hideBelow: 'md', render: row => <StatusBadge tone={row.consent ? 'success' : 'neutral'}>{row.consent ? 'Autorizado' : 'Sin consentimiento'}</StatusBadge> },
    { key: 'state', header: 'Estado', width: '130px', render: row => <StatusBadge tone={row.paused ? 'warning' : row.state === 'cancelled' ? 'neutral' : 'info'}>{row.paused ? 'Pausado' : states[row.state] ?? 'Por revisar'}</StatusBadge> },
  ]);
  return <div className="space-y-4">
    {query.isError ? <div role="alert" className="space-y-2"><p className="text-sm text-danger">No se pudieron cargar los interesados.</p><Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></div> : null}
    {interest.isError ? <p role="alert" className="text-sm text-danger">{getPublicErrorMessage(interest.error, 'No se pudo completar la acción. Reintenta.')}</p> : null}
    {notice ? <p role="status" className="text-sm text-success">{notice}</p> : null}
    <TableCard title="Interesados por servicios agotados" description="El interés y el consentimiento se registran por separado. Un aviso requiere disponibilidad y autorización." toolbar={<TableToolbar><TableSearch value={search} onChange={setSearch} placeholder="Buscar servicio o contacto…" /><FilterMenu icon={ListFilter} ariaLabel="Estado del interés" value={filter} options={[{ value: 'all', label: 'Todos' }, { value: 'eligible', label: 'Con aviso autorizado' }, { value: 'paused', label: 'Pausados' }, { value: 'without-consent', label: 'Sin consentimiento' }]} onChange={setFilter} /></TableToolbar>}>
      <DataTable bare fixedLayout autoPageSize pagination data={rows} columns={columns} loading={query.isLoading} emptyMessage="No hay interesados en esta vista." actions={item => <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Acciones del interés" disabled={interest.isPending}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={!item.consent || item.paused || ['cancelled', 'fulfilled', 'notified', 'invited'].includes(item.state)} onClick={() => act(item, 'notify')}>Avisar disponibilidad</DropdownMenuItem><DropdownMenuItem disabled={['cancelled', 'fulfilled'].includes(item.state)} onClick={() => act(item, item.paused ? 'resume' : 'pause')}>{item.paused ? 'Reactivar avisos' : 'Pausar avisos'}</DropdownMenuItem><DropdownMenuItem variant="destructive" disabled={['cancelled', 'fulfilled'].includes(item.state)} onClick={() => setCancel(item)}>Cancelar interés</DropdownMenuItem></DropdownMenuContent></DropdownMenu>} />
    </TableCard>
    <AlertDialog open={cancel !== null} onOpenChange={open => { if (!open) setCancel(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Cancelar interés</AlertDialogTitle><AlertDialogDescription>Se cancelará la espera por {cancel?.plan || cancel?.category}. No se enviarán nuevos avisos.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Volver</AlertDialogCancel><AlertDialogAction disabled={interest.isPending} onClick={event => { event.preventDefault(); if (cancel) act(cancel, 'cancel'); }}>Cancelar interés</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

