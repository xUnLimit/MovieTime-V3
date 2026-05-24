'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { CambiosModal } from '@/components/log-actividad/CambiosModal';
import { LogFilters } from '@/components/log-actividad/LogFilters';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PaginationFooter } from '@/components/shared/PaginationFooter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { countActivityLogsUseCase } from '@/lib/use-cases/activity-log-use-cases';
import { createLogTimelineColumns } from './log-timeline-columns';
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

  const columns = createLogTimelineColumns({
    isAllSelected,
    selectedLogs,
    toggleSelectAll,
    toggleSelection,
    onOpenCambios: handleOpenCambios,
  });

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
