'use client';

import { useMemo, useState } from 'react';
import { estimateInitialPageSize } from '@/hooks/useFitPageSize';
import { PageHeader } from '@/components/shared/PageHeader';

import { LogTimeline } from '@/components/log-actividad/LogTimeline';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { useServerPagination } from '@/hooks/useServerPagination';
import { ACTIVITY_LOG_COLLECTION } from '@/application/use-cases/activity-log-use-cases';
import {
  deleteAllActivityLogsUseCase,
  deleteActivityLogsOlderThanUseCase,
  deleteActivityLogsUseCase,
} from '@/application/use-cases/activity-log-use-cases';
import { ActivityLog } from '@/types';
import type { FilterOption } from '@/types/pagination';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { reportError } from '@/platform/observability/logger';

function LogActividadPageContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [accionFilter, setAccionFilter] = useState('all');
  const [entidadFilter, setEntidadFilter] = useState('all');
  const [usuarioFilter, setTerceroFilter] = useState('all');
  const [pageSize, setPageSize] = useState(() => estimateInitialPageSize());
  const user = useAuthStore((state) => state.user);
  const canDeleteLogs = user?.role === 'admin';

  // Construir filtros para Supabase
  const filters = useMemo((): FilterOption[] => {
    const f: FilterOption[] = [];
    if (accionFilter !== 'all') {
      f.push({ field: 'accion', operator: '==', value: accionFilter });
    }
    if (entidadFilter !== 'all') {
      f.push({ field: 'entidad', operator: '==', value: entidadFilter });
    }
    if (usuarioFilter !== 'all') {
      f.push({ field: 'usuarioId', operator: '==', value: usuarioFilter });
    }
    return f;
  }, [accionFilter, entidadFilter, usuarioFilter]);

  const { data: logs, isLoading, hasMore, page, totalPages, hasPrevious, next, previous, refresh } = useServerPagination<ActivityLog>({
    collectionName: ACTIVITY_LOG_COLLECTION,
    filters,
    pageSize,
    orderByField: 'timestamp',
    orderDirection: 'desc',
    includeTotalCount: true,
  });

  // Filtrado client-side solo para búsqueda de texto (no se puede hacer server-side)
  const filteredLogs = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    if (!normalizedSearchTerm) return logs;
    return logs.filter((log) => {
      return (
        log.id.toLowerCase().includes(normalizedSearchTerm) ||
        log.entidadId.toLowerCase().includes(normalizedSearchTerm) ||
        log.entidadNombre?.toLowerCase().includes(normalizedSearchTerm) ||
        log.usuarioEmail?.toLowerCase().includes(normalizedSearchTerm) ||
        log.detalles?.toLowerCase().includes(normalizedSearchTerm)
      );
    });
  }, [logs, searchTerm]);

  // Delete handlers
  const handleDeleteSelected = async (ids: string[]) => {
    try {
      await deleteActivityLogsUseCase(ids);
      toast.success('Registros eliminados', { description: `${ids.length} registro(s) han sido eliminados del log de actividad.` });
      refresh();
    } catch (error) {
      reportError('LogActividadPage', 'Error deleting logs', error);
      toast.error('Error al eliminar registros', { description: 'No se pudieron eliminar los registros seleccionados. Intenta nuevamente.' });
    }
  };

  const handleDeleteByDays = async (days: number) => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const deletedCount = await deleteActivityLogsOlderThanUseCase(cutoff);
      toast.success('Registros antiguos eliminados', { description: `${deletedCount} registro(s) anterior(es) al período seleccionado han sido eliminados.` });
      refresh();
    } catch (error) {
      reportError('LogActividadPage', 'Error deleting old logs', error);
      toast.error('Error al eliminar registros', { description: 'No se pudieron eliminar los registros antiguos. Intenta nuevamente.' });
    }
  };

  const handleDeleteAll = async () => {
    try {
      const deletedCount = await deleteAllActivityLogsUseCase();
      toast.success('Log de actividad eliminado', { description: `${deletedCount} registro(s) han sido eliminados.` });
      refresh();
    } catch (error) {
      reportError('LogActividadPage', 'Error deleting all logs', error);
      toast.error('Error al eliminar registros', { description: 'No se pudieron eliminar todos los registros. Intenta nuevamente.' });
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <PageHeader
        title="Log de Actividad"
      />

      <LogTimeline
        logs={filteredLogs}
        unfilteredPageCount={logs.length}
        isLoading={isLoading}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        accionFilter={accionFilter}
        setAccionFilter={setAccionFilter}
        entidadFilter={entidadFilter}
        setEntidadFilter={setEntidadFilter}
        usuarioFilter={usuarioFilter}
        setTerceroFilter={setTerceroFilter}
        // Paginación
        hasMore={hasMore}
        hasPrevious={hasPrevious}
        page={page}
        totalPages={totalPages}
        onNext={next}
        onPrevious={previous}
        onRefresh={refresh}
        // Delete handlers
        canDeleteLogs={canDeleteLogs}
        onDeleteSelected={handleDeleteSelected}
        onDeleteByDays={handleDeleteByDays}
        onDeleteAll={handleDeleteAll}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}

export default function LogActividadPage() {
  return (
    <ModuleErrorBoundary moduleName="Log de Actividad">
      <LogActividadPageContent />
    </ModuleErrorBoundary>
  );
}
