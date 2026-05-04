'use client';

import { ActivityLog } from '@/types';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogFilters } from './LogFilters';
import { CambiosModal } from './CambiosModal';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';
import { Eye, AlertTriangle, Loader2 } from 'lucide-react';
import { PaginationFooter } from '@/components/shared/PaginationFooter';
import { getActivityDisplayConfig, activityActionColors } from '@/lib/utils/activityDisplayHelpers';
import { getCount, COLLECTIONS } from '@/lib/firebase/firestore';
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
  isLoading: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  accionFilter: string;
  setAccionFilter: (value: string) => void;
  entidadFilter: string;
  setEntidadFilter: (value: string) => void;
  usuarioFilter: string;
  setUsuarioFilter: (value: string) => void;
  // Paginación
  hasMore: boolean;
  hasPrevious: boolean;
  page: number;
  onNext: () => void;
  onPrevious: () => void;
  onRefresh: () => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  // Delete handlers
  onDeleteSelected: (ids: string[]) => Promise<void>;
  onDeleteByDays: (days: number) => Promise<void>;
}

export function LogTimeline({
  logs,
  isLoading,
  searchTerm,
  setSearchTerm,
  accionFilter,
  setAccionFilter,
  entidadFilter,
  setEntidadFilter,
  usuarioFilter,
  setUsuarioFilter,
  hasMore,
  hasPrevious,
  page,
  onNext,
  onPrevious,
  onDeleteSelected,
  onDeleteByDays,
  pageSize,
  onPageSizeChange,
}: LogTimelineProps) {
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [cambiosModalOpen, setCambiosModalOpen] = useState(false);

  // Modal de confirmación para limpiar por días
  const [confirmDays, setConfirmDays] = useState<number | null>(null);
  const [confirmCount, setConfirmCount] = useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const getActionBadgeStyle = (accion: ActivityLog['accion']) => {
    const styles: Record<string, string> = {
      creacion:     'bg-green-100 text-green-700 border-green-300 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30',
      actualizacion:'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
      eliminacion:  'bg-red-100 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
      renovacion:   'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30',
    };
    return styles[accion] ?? activityActionColors[accion] ?? '';
  };

  const getActionLabel = (accion: ActivityLog['accion']) => {
    const labels = {
      creacion: 'Creación',
      actualizacion: 'Actualización',
      eliminacion: 'Eliminación',
      renovacion: 'Renovación',
    };
    return labels[accion];
  };

  const getEntityLabel = (entidad: ActivityLog['entidad']) => {
    const labels = {
      cliente: 'Cliente',
      revendedor: 'Revendedor',
      servicio: 'Servicio',
      usuario: 'Usuario',
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
    setConfirmCount(null);
    setIsLoadingCount(true);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const count = await getCount(COLLECTIONS.ACTIVITY_LOG, [
      { field: 'timestamp', operator: '<', value: cutoff },
    ]);
    setConfirmCount(count);
    setIsLoadingCount(false);
  };

  const handleConfirmDeleteByDays = async () => {
    if (confirmDays === null) return;
    setIsDeleting(true);
    await onDeleteByDays(confirmDays);
    setSelectedLogs(new Set());
    setIsDeleting(false);
    setConfirmDays(null);
    setConfirmCount(null);
  };

  const handleOpenCambios = (log: ActivityLog) => {
    setSelectedLog(log);
    setCambiosModalOpen(true);
  };

  const isAllSelected = logs.length > 0 && selectedLogs.size === logs.length;

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
      width: '16%',
      render: (item) => (
        <div className="text-sm">
          {format(new Date(item.timestamp), 'dd MMM yyyy, hh:mm:ss a', { locale: es })}
        </div>
      ),
    },
    {
      key: 'usuarioEmail',
      header: 'Usuario',
      sortable: true,
      align: 'center',
      width: '15%',
      render: (item) => <div className="text-sm">{item.usuarioEmail}</div>,
    },
    {
      key: 'accion',
      header: 'Acción',
      sortable: true,
      align: 'center',
      width: '12%',
      render: (item) => (
        <Badge variant="outline" className={getActionBadgeStyle(item.accion)}>
          {getActionLabel(item.accion)}
        </Badge>
      ),
    },
    {
      key: 'entidad',
      header: 'Entidad',
      sortable: true,
      align: 'center',
      width: '12%',
      render: (item) => <div className="text-sm">{getEntityLabel(item.entidad)}</div>,
    },
    {
      key: 'detalles',
      header: 'Detalles',
      align: 'left',
      width: '28%',
      render: (item) => {
        const { icon: Icon, color, message } = getActivityDisplayConfig(item);
        const [bgColor, textColor] = color.split(' ');
        return (
          <div className="flex items-center gap-2 px-2">
            <div className={`flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full ${bgColor}`}>
              <Icon className={`h-3 w-3 ${textColor}`} />
            </div>
            <span className="text-sm">{message}</span>
          </div>
        );
      },
    },
    {
      key: 'cambios',
      header: 'Cambios',
      align: 'center',
      width: '12%',
      render: (item) => (
        <div className="flex items-center justify-center">
          {item.cambios && item.cambios.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenCambios(item)}
              className="h-8 px-3 text-xs font-medium text-purple-600 hover:bg-purple-500/10 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
            >
              <Eye className="h-4 w-4 mr-1.5" />
              Ver ({item.cambios.length})
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground/40">—</span>
          )}
        </div>
      ),
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
          setUsuarioFilter={setUsuarioFilter}
          selectedCount={selectedLogs.size}
          onDeleteSelected={handleDeleteSelected}
          onRequestDeleteByDays={handleRequestDeleteByDays}
        />
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="border border-border rounded-md p-12 text-center">
            <p className="text-sm text-muted-foreground">Cargando logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="border border-border rounded-md p-12 text-center">
            <p className="text-sm text-muted-foreground">No hay actividad registrada</p>
          </div>
        ) : (
          <>
            <DataTable
              data={logs as unknown as Record<string, unknown>[]}
              columns={columns as unknown as Column<Record<string, unknown>>[]}
              pagination={false}
            />

            <PaginationFooter
              page={page}
              totalPages={hasMore ? page + 1 : page}
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
      {selectedLog && selectedLog.cambios && (
        <CambiosModal
          open={cambiosModalOpen}
          onOpenChange={setCambiosModalOpen}
          entidadNombre={selectedLog.entidadNombre}
          cambios={selectedLog.cambios}
        />
      )}

      {/* Modal de confirmación para limpiar por días */}
      <Dialog open={confirmDays !== null} onOpenChange={(open) => { if (!open && !isDeleting) { setConfirmDays(null); setConfirmCount(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              ¿Estás seguro de limpiar los logs?
            </DialogTitle>
            <DialogDescription className="pt-1">
              Esta acción eliminará permanentemente todos los registros con más de{' '}
              <span className="font-semibold text-foreground">{confirmDays} días</span> de antigüedad.
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
              onClick={() => { setConfirmDays(null); setConfirmCount(null); }}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteByDays}
              disabled={isLoadingCount || isDeleting || confirmCount === 0}
            >
              {isDeleting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Eliminando...</>
              ) : (
                'Sí, limpiar logs'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
