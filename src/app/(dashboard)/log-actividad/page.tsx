'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { LogTimeline } from '@/components/log-actividad/LogTimeline';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { useServerPagination } from '@/hooks/useServerPagination';
import { COLLECTIONS, remove, queryDocuments } from '@/lib/firebase/firestore';
import { ActivityLog } from '@/types';
import { FilterOption } from '@/lib/firebase/pagination';
import { toast } from 'sonner';

function LogActividadPageContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [accionFilter, setAccionFilter] = useState('all');
  const [entidadFilter, setEntidadFilter] = useState('all');
  const [usuarioFilter, setUsuarioFilter] = useState('all');
  const [pageSize, setPageSize] = useState(10);

  // Construir filtros para Firestore
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

  const { data: logs, isLoading, hasMore, page, hasPrevious, next, previous, refresh } = useServerPagination<ActivityLog>({
    collectionName: COLLECTIONS.ACTIVITY_LOG,
    filters,
    pageSize,
    orderByField: 'timestamp',
    orderDirection: 'desc',
  });

  // Filtrado client-side solo para búsqueda de texto (no se puede hacer en Firestore)
  const filteredLogs = useMemo(() => {
    if (!searchTerm) return logs;
    return logs.filter((log) => {
      return (
        log.entidadNombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.usuarioEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.detalles?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [logs, searchTerm]);

  // Delete handlers
  const handleDeleteSelected = async (ids: string[]) => {
    try {
      await Promise.all(ids.map(id => remove(COLLECTIONS.ACTIVITY_LOG, id)));
      toast.success('Registros eliminados', { description: `${ids.length} registro(s) han sido eliminados del log de actividad.` });
      refresh();
    } catch (error) {
      console.error('Error deleting logs:', error);
      toast.error('Error al eliminar registros', { description: 'No se pudieron eliminar los registros seleccionados. Intenta nuevamente.' });
    }
  };

  const handleDeleteByDays = async (days: number) => {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const oldLogs = await queryDocuments<ActivityLog>(COLLECTIONS.ACTIVITY_LOG, [
        { field: 'timestamp', operator: '<', value: cutoff }
      ]);
      await Promise.all(oldLogs.map(log => remove(COLLECTIONS.ACTIVITY_LOG, log.id)));
      toast.success('Registros antiguos eliminados', { description: `${oldLogs.length} registro(s) anterior(es) al período seleccionado han sido eliminados.` });
      refresh();
    } catch (error) {
      console.error('Error deleting old logs:', error);
      toast.error('Error al eliminar registros', { description: 'No se pudieron eliminar los registros antiguos. Intenta nuevamente.' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Log de Actividad</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link> / <span className="text-foreground">Log de Actividad</span>
        </p>
      </div>

      <LogTimeline
        logs={filteredLogs}
        isLoading={isLoading}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        accionFilter={accionFilter}
        setAccionFilter={setAccionFilter}
        entidadFilter={entidadFilter}
        setEntidadFilter={setEntidadFilter}
        usuarioFilter={usuarioFilter}
        setUsuarioFilter={setUsuarioFilter}
        // Paginación
        hasMore={hasMore}
        hasPrevious={hasPrevious}
        page={page}
        onNext={next}
        onPrevious={previous}
        onRefresh={refresh}
        // Delete handlers
        onDeleteSelected={handleDeleteSelected}
        onDeleteByDays={handleDeleteByDays}
        pageSize={pageSize}
        onPageSizeChange={(size) => { setPageSize(size); refresh(); }}
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
