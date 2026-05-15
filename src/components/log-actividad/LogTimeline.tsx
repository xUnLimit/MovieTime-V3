'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, Eye, Loader2 } from 'lucide-react';

import { CambiosModal } from '@/components/log-actividad/CambiosModal';
import { LogFilters } from '@/components/log-actividad/LogFilters';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PaginationFooter } from '@/components/shared/PaginationFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { countActivityLogsUseCase } from '@/lib/use-cases/activity-log-use-cases';
import {
  activityActionColors,
  getActivityDisplayConfig,
  isCorteActivityLog,
} from '@/lib/utils/activityDisplayHelpers';
import type { ActivityLog } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface LogTimelineProps {
  logs: ActivityLog[];
  unfilteredPageCount?: number;
  isLoading: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  accionFilter: string;
  setAccionFilter: (value: string) => void;
  entidadFilter: string;
  setEntidadFilter: (value: string) => void;
  usuarioFilter: string;
  setTerceroFilter: (value: string) => void;
  // Paginación
  hasMore: boolean;
  hasPrevious: boolean;
  page: number;
  totalPages: number;
  onNext: () => void;
  onPrevious: () => void;
  onRefresh: () => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  // Delete handlers
  canDeleteLogs?: boolean;
  onDeleteSelected: (ids: string[]) => Promise<void>;
  onDeleteByDays: (days: number) => Promise<void>;
  onDeleteAll: () => Promise<void>;
}

export function LogTimeline({
  logs,
  unfilteredPageCount = logs.length,
  isLoading,
  searchTerm,
  setSearchTerm,
  accionFilter,
  setAccionFilter,
  entidadFilter,
  setEntidadFilter,
  usuarioFilter,
  setTerceroFilter,
  hasMore,
  hasPrevious,
  page,
  totalPages,
  onNext,
  onPrevious,
  canDeleteLogs = false,
  onDeleteSelected,
  onDeleteByDays,
  onDeleteAll,
  pageSize,
  onPageSizeChange,
}: LogTimelineProps) {
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [cambiosModalOpen, setCambiosModalOpen] = useState(false);

  // Modal de confirmación para limpiar por días
  const [confirmDays, setConfirmDays] = useState<number | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmCount, setConfirmCount] = useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const getActionBadgeStyle = (item: ActivityLog) => {
    if (isCorteActivityLog(item)) {
      return 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30';
    }

    const styles: Record<string, string> = {
      creacion:     'bg-green-100 text-green-700 border-green-300 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30',
      actualizacion:'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
      corte:        'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30',
      eliminacion:  'bg-red-100 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
      renovacion:   'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30',
    };
    return styles[item.accion] ?? activityActionColors[item.accion] ?? '';
  };

  const getActionLabel = (item: ActivityLog) => {
    if (isCorteActivityLog(item)) return 'Corte';

    const labels = {
      creacion: 'Creación',
      actualizacion: 'Actualización',
      corte: 'Corte',
      eliminacion: 'Eliminación',
      renovacion: 'Renovación',
    };
    return labels[item.accion];
  };

  const getEntityLabel = (entidad: ActivityLog['entidad']) => {
    const labels = {
      cliente: 'Cliente',
      revendedor: 'Revendedor',
      servicio: 'Servicio',
      tercero: 'Tercero',
      categoria: 'Categoría',
      metodo_pago: 'Método de Pago',
      gasto: 'Gasto',
      venta: 'Venta',
      template: 'Template',
    };
    return labels[entidad];
  };

  const toggleSelection = (logId: string) => {
    const newSelection = new Set(selectedLogs);
    if (newSelection.has(logId)) {
      newSelection.delete(logId);
    } else {
      newSelection.add(logId);
    }
    setSelectedLogs(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedLogs.size === logs.length) {
      setSelectedLogs(new Set());
    } else {
      const allLogIds = new Set(logs.map(log => log.id));
      setSelectedLogs(allLogIds);
    }
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedLogs);
    await onDeleteSelected(ids);
    setSelectedLogs(new Set());
  };

  const handleRequestDeleteByDays = async (days: number) => {
    setConfirmDays(days);
    setConfirmDeleteAll(false);
    setConfirmCount(null);
    setIsLoadingCount(true);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const count = await countActivityLogsUseCase([
      { field: 'timestamp', operator: '<', value: cutoff },
    ]);
    setConfirmCount(count);
    setIsLoadingCount(false);
  };

  const handleRequestDeleteAll = async () => {
    setConfirmDays(null);
    setConfirmDeleteAll(true);
    setConfirmCount(null);
    setIsLoadingCount(true);
    const count = await countActivityLogsUseCase();
    setConfirmCount(count);
    setIsLoadingCount(false);
  };

  const handleCloseDeleteConfirm = () => {
    setConfirmDays(null);
    setConfirmDeleteAll(false);
    setConfirmCount(null);
  };

  const handleConfirmDelete = async () => {
    if (confirmDays === null && !confirmDeleteAll) return;
    setIsDeleting(true);
    if (confirmDeleteAll) {
      await onDeleteAll();
    } else if (confirmDays !== null) {
      await onDeleteByDays(confirmDays);
    }
    setSelectedLogs(new Set());
    setIsDeleting(false);
    handleCloseDeleteConfirm();
  };

  const handleOpenCambios = (log: ActivityLog) => {
    setSelectedLog(log);
    setCambiosModalOpen(true);
  };

  const isAllSelected = logs.length > 0 && selectedLogs.size === logs.length;
  const hasSearchTerm = searchTerm.trim().length > 0;
  const searchFilteredCurrentPage = hasSearchTerm && unfilteredPageCount > 0 && logs.length === 0;
  const isDeleteConfirmOpen = confirmDays !== null || confirmDeleteAll;

  const columns: Column<ActivityLog>[] = [
    {
      key: 'checkbox',
      header: '',
      width: '40px',
      headerRender: () => (
        <Checkbox
          checked={isAllSelected}
          onCheckedChange={toggleSelectAll}
          className="border-purple-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
        />
      ),
      render: (item) => (
        <Checkbox
          checked={selectedLogs.has(item.id)}
          onCheckedChange={() => toggleSelection(item.id)}
          className="border-purple-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
        />
      ),
    },
    {
      key: 'timestamp',
      header: 'Fecha',
      sortable: true,
      width: '170px',
      render: (item) => {
        const formattedTimestamp = format(
          new Date(item.timestamp),
          'dd MMM yyyy, hh:mm:ss a',
          { locale: es }
        );

        return (
          <div className="truncate text-sm" title={formattedTimestamp}>
            {formattedTimestamp}
          </div>
        );
      },
    },
    {
      key: 'usuarioEmail',
      header: 'Tercero',
      sortable: true,
      align: 'center',
      width: '180px',
      render: (item) => (
        <div className="truncate text-sm" title={item.usuarioEmail}>
          {item.usuarioEmail}
        </div>
      ),
    },
    {
      key: 'accion',
      header: 'Acción',
      sortable: true,
      align: 'center',
      width: '130px',
      render: (item) => (
        <Badge variant="outline" className={getActionBadgeStyle(item)}>
          {getActionLabel(item)}
        </Badge>
      ),
    },
    {
      key: 'entidad',
      header: 'Entidad',
      sortable: true,
      align: 'center',
      width: '120px',
      render: (item) => <div className="text-sm">{getEntityLabel(item.entidad)}</div>,
    },
    {
      key: 'detalles',
      header: 'Detalles',
      align: 'left',
      width: '340px',
      render: (item) => {
        const { icon: Icon, color, message } = getActivityDisplayConfig(item);
        const [bgColor, textColor] = color.split(' ');
        return (
          <div className="flex w-full min-w-0 items-center gap-2 px-2">
            <div className={`flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full ${bgColor}`}>
              <Icon className={`h-3 w-3 ${textColor}`} />
            </div>
            <span className="min-w-0 flex-1 truncate text-sm" title={item.detalles}>
              {message}
            </span>
          </div>
        );
      },
    },
    {
      key: 'cambios',
      header: 'Cambios',
      align: 'center',
      width: '110px',
      render: (item) => {
        const cambiosCount = item.cambios?.length ?? 0;
        const hasMetadata = item.metadata && Object.keys(item.metadata).length > 0;
        return (
          <div className="flex items-center justify-center">
            {cambiosCount > 0 || hasMetadata ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => handleOpenCambios(item)}
                className="text-xs font-medium text-purple-600 transition-colors hover:bg-purple-500/10 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
              >
                <Eye className="h-3 w-3" />
                {cambiosCount > 0 ? `Ver (${cambiosCount})` : 'Metadata'}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground/40">—</span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Card className="p-4">
      <div className="mb-4">
        <LogFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          accionFilter={accionFilter}
          setAccionFilter={setAccionFilter}
          entidadFilter={entidadFilter}
          setEntidadFilter={setEntidadFilter}
          usuarioFilter={usuarioFilter}
          setTerceroFilter={setTerceroFilter}
          selectedCount={selectedLogs.size}
          canDeleteLogs={canDeleteLogs}
          onDeleteSelected={handleDeleteSelected}
          onRequestDeleteByDays={handleRequestDeleteByDays}
          onRequestDeleteAll={handleRequestDeleteAll}
        />
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="border border-border rounded-md p-12 text-center">
            <p className="text-sm text-muted-foreground">Cargando logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <>
            <div className="border border-border rounded-md p-12 text-center">
              <p className="text-sm text-muted-foreground">
                {searchFilteredCurrentPage
                  ? 'No hay coincidencias en esta página'
                  : 'No hay actividad registrada'}
              </p>
              {searchFilteredCurrentPage ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  La búsqueda se aplica sobre los registros cargados. Usa la paginación para revisar más páginas.
                </p>
              ) : null}
            </div>

            {searchFilteredCurrentPage ? (
              <PaginationFooter
                page={page}
                totalPages={totalPages}
                hasPrevious={hasPrevious}
                hasMore={hasMore}
                onPrevious={onPrevious}
                onNext={onNext}
                pageSize={pageSize}
                onPageSizeChange={onPageSizeChange}
              />
            ) : null}
          </>
        ) : (
          <>
            <DataTable
              data={logs as unknown as Record<string, unknown>[]}
              columns={columns as unknown as Column<Record<string, unknown>>[]}
              pagination={false}
              fixedLayout
              containerClassName="table-scroll-shell"
              tableClassName="table-scroll-content min-w-[1100px]"
            />

            <PaginationFooter
              page={page}
              totalPages={totalPages}
              hasPrevious={hasPrevious}
              hasMore={hasMore}
              onPrevious={onPrevious}
              onNext={onNext}
              pageSize={pageSize}
              onPageSizeChange={onPageSizeChange}
            />
          </>
        )}
      </div>

      {/* Modal de cambios */}
      {selectedLog && (
        <CambiosModal
          open={cambiosModalOpen}
          onOpenChange={setCambiosModalOpen}
          entidadNombre={selectedLog.entidadNombre}
          cambios={selectedLog.cambios ?? []}
          metadata={selectedLog.metadata}
        />
      )}

      {/* Modal de confirmación para limpiar logs */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={(open) => { if (!open && !isDeleting) handleCloseDeleteConfirm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              {confirmDeleteAll ? '¿Estás seguro de eliminar todos los logs?' : '¿Estás seguro de limpiar los logs?'}
            </DialogTitle>
            <DialogDescription className="pt-1">
              {confirmDeleteAll ? (
                <>
                  Esta acción eliminará permanentemente todo el log de actividad.
                </>
              ) : (
                <>
                  Esta acción eliminará permanentemente todos los registros con más de{' '}
                  <span className="font-semibold text-foreground">{confirmDays} días</span> de antigüedad.
                </>
              )}
              {isLoadingCount ? (
                <span className="flex items-center gap-1.5 mt-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Calculando registros...
                </span>
              ) : confirmCount !== null ? (
                <span className="block mt-2">
                  Se eliminarán{' '}
                  <span className="font-semibold text-red-500">{confirmCount} {confirmCount === 1 ? 'registro' : 'registros'}</span>.{' '}
                  Esta acción no se puede deshacer.
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleCloseDeleteConfirm}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isLoadingCount || isDeleting || confirmCount === 0}
            >
              {isDeleting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Eliminando...</>
              ) : (
                confirmDeleteAll ? 'Sí, eliminar todos' : 'Sí, limpiar logs'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
