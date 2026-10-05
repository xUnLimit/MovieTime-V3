import Link from 'next/link';
import { Activity, MessageSquare } from 'lucide-react';

import { DataTable, defineDataTableColumns } from '@/components/shared/DataTable';
import { ServerTableCard } from '@/components/shared/ServerTableCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FilterMenu, TableToolbar, type FilterOption } from '@/components/shared/TableToolbar';
import type { Tone } from '@/components/shared/tone';
import { Button } from '@/components/ui/button';
import type { RecentNoticesApi } from '@/hooks/use-template-notices';
import { NOTICE_STATUS_LABELS, skipReasonLabel } from '@/modules/messaging/automation-activity';
import { TEMPLATE_TIPOS, tipoLabel } from '@/modules/messaging/template-tipos';
import type { NoticeStatus, RecentNotice } from '@/types/automation';
import { formatClock, formatDay } from './notice-format';

const ALL = 'todos';
const STATUS_TONE: Record<NoticeStatus, Tone> = { accepted: 'success', failed: 'danger', skipped: 'warning', pending: 'neutral' };
const TIPO_OPTIONS: FilterOption[] = [{ value: ALL, label: 'Todos los mensajes' }, ...TEMPLATE_TIPOS.map((item) => ({ value: item.value, label: item.label }))];
const STATUS_OPTIONS: FilterOption[] = [
  { value: ALL, label: 'Todos los estados' },
  ...(Object.keys(NOTICE_STATUS_LABELS) as NoticeStatus[]).map((value) => ({ value, label: NOTICE_STATUS_LABELS[value] })),
];

function isStatus(value: string): value is NoticeStatus {
  return value in NOTICE_STATUS_LABELS;
}

const columns = defineDataTableColumns<RecentNotice>([
  {
    key: 'tipo', header: 'Mensaje', width: '28%',
    render: (notice) => (
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-medium">{tipoLabel(notice.tipo)}</p>
        <p className="truncate text-xs text-muted-foreground">{notice.origin === 'auto' ? 'Automático' : 'Manual'}</p>
      </div>
    ),
  },
  {
    key: 'cliente', header: 'Cliente', width: '26%',
    render: (notice) => (
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-medium">{notice.clienteNombre ?? notice.waId}</p>
        <p className="truncate text-xs text-muted-foreground tabular-nums">{notice.waId}</p>
      </div>
    ),
  },
  {
    key: 'status', header: 'Estado', width: '22%',
    render: (notice) => {
      const reason = notice.status === 'skipped' ? skipReasonLabel(notice.skipReason) : null;
      return (
        <div className="min-w-0 leading-tight">
          <StatusBadge tone={STATUS_TONE[notice.status]}>{NOTICE_STATUS_LABELS[notice.status]}</StatusBadge>
          {reason ? <p className="truncate text-xs text-muted-foreground">{reason}</p> : null}
        </div>
      );
    },
  },
  {
    key: 'createdAt', header: 'Fecha', width: '16%',
    render: (notice) => (
      <div className="min-w-0 leading-tight tabular-nums">
        <p className="truncate text-sm">{formatDay(notice.createdAt)}</p>
        <p className="truncate text-xs text-muted-foreground">{formatClock(notice.createdAt)}</p>
      </div>
    ),
  },
  {
    key: 'chat', header: 'Chat', width: '4.5rem',
    render: (notice) => (
      <Button asChild variant="ghost" size="sm">
        <Link href={`/chats?wa=${encodeURIComponent(notice.waId)}`} aria-label={`Abrir chat de ${notice.clienteNombre ?? notice.waId}`}>Chat</Link>
      </Button>
    ),
  },
]);

/** Historial de avisos de WhatsApp de todas las plantillas, filtrable por mensaje y estado, paginado en el servidor. */
export function RecentNoticesTable({ notices }: { notices: RecentNoticesApi }) {
  const { data, filters, setFilters, setPage } = notices;
  const page = data?.page ?? 1;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = Boolean(filters.tipo || filters.status);
  const toolbar = (
    <TableToolbar>
      <FilterMenu
        icon={MessageSquare} ariaLabel="Filtrar por mensaje" value={filters.tipo ?? ALL} options={TIPO_OPTIONS}
        onChange={(value) => setFilters({ ...filters, tipo: TEMPLATE_TIPOS.find((item) => item.value === value)?.value })}
      />
      <FilterMenu
        icon={Activity} ariaLabel="Filtrar por estado" value={filters.status ?? ALL} options={STATUS_OPTIONS}
        onChange={(value) => setFilters({ ...filters, status: isStatus(value) ? value : undefined })}
      />
    </TableToolbar>
  );

  return (
    <ServerTableCard
      title="Historial de envíos"
      description="Los avisos de WhatsApp más recientes de todas las plantillas; el texto enviado no se muestra."
      toolbar={toolbar}
      rowCount={data?.notices.length ?? 0}
      loading={notices.loading}
      pagination={{
        page, totalPages, hasPrevious: page > 1, hasMore: page < totalPages,
        onPrevious: () => setPage(page - 1), onNext: () => setPage(page + 1), pageSize: data?.pageSize ?? 10,
      }}
    >
      {notices.error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 px-4 py-6 text-sm">
          <p className="text-danger">{notices.error}</p>
          <Button variant="outline" size="sm" onClick={notices.retry}>Reintentar</Button>
        </div>
      ) : (
        <DataTable
          bare fixedLayout loading={notices.loading} data={data?.notices ?? []} columns={columns}
          emptyMessage={filtered ? 'No hay envíos con estos filtros' : 'Todavía no hay envíos de WhatsApp'}
        />
      )}
    </ServerTableCard>
  );
}
