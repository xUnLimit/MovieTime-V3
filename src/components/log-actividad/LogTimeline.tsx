'use client';

import { useState } from 'react';

import { CambiosModal } from '@/components/log-actividad/CambiosModal';
import { LogDeleteConfirmDialog } from '@/components/log-actividad/LogDeleteConfirmDialog';
import { LogFilters } from '@/components/log-actividad/LogFilters';
import { DataTable } from '@/components/shared/DataTable';
import { PaginationFooter } from '@/components/shared/PaginationFooter';
import { Card } from '@/components/ui/card';
import { countActivityLogsUseCase } from '@/lib/use-cases/activity-log-use-cases';
import type { ActivityLog } from '@/types';
import { createLogTimelineColumns } from './log-timeline-columns';

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
  hasMore: boolean;
  hasPrevious: boolean;
  page: number;
  totalPages: number;
  onNext: () => void;
  onPrevious: () => void;
  onRefresh: () => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
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
              data={logs}
              columns={columns}
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

      {selectedLog && (
        <CambiosModal
          open={cambiosModalOpen}
          onOpenChange={setCambiosModalOpen}
          entidadNombre={selectedLog.entidadNombre}
          cambios={selectedLog.cambios ?? []}
          metadata={selectedLog.metadata}
        />
      )}

      <LogDeleteConfirmDialog
        confirmCount={confirmCount}
        confirmDays={confirmDays}
        confirmDeleteAll={confirmDeleteAll}
        isDeleting={isDeleting}
        isLoadingCount={isLoadingCount}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleConfirmDelete}
        open={isDeleteConfirmOpen}
      />
    </Card>
  );
}
