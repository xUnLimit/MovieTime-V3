'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus, ArrowLeft } from 'lucide-react';
import { ServiciosCategoriaMetrics } from '@/components/servicios/ServiciosCategoriaMetrics';
import { ServiciosCategoriaFilters } from '@/components/servicios/ServiciosCategoriaFilters';
import { ServiciosCategoriaTableDetalle } from '@/components/servicios/ServiciosCategoriaTableDetalle';
import { useCategoriasStore } from '@/store/categoriasStore';
import { useServiciosStore } from '@/store/serviciosStore';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { useServerPagination } from '@/hooks/useServerPagination';
import { COLLECTIONS } from '@/lib/firebase/firestore';
import { Servicio } from '@/types';
import type { FilterOption } from '@/lib/firebase/pagination';

function ServiciosCategoriaPageContent() {
  const params = useParams();
  const router = useRouter();
  const categoriaId = params.id as string;

  const { categorias, fetchCategorias } = useCategoriasStore();
  const { fetchServicios, servicios: todosLosServicios } = useServiciosStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [cicloFilter, setCicloFilter] = useState('todos');
  const [perfilFilter, setPerfilFilter] = useState('todos');
  const [estadoFilter, setEstadoFilter] = useState('activo');
  const [pageSize, setPageSize] = useState(10);
  const isSearchMode = searchTerm.trim().length > 0;
  // Si hay filtros client-side activos (ciclo o perfil), necesitamos fetchAll para no perder resultados de otras páginas
  const needsFullFetch = cicloFilter !== 'todos' || perfilFilter !== 'todos';
  const isFetchAllMode = isSearchMode || needsFullFetch;

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  // Construir filtros dinámicos
  const filters = useMemo(() => {
    const baseFilters: FilterOption[] = [
      { field: 'categoriaId', operator: '==', value: categoriaId }
    ];

    if (estadoFilter === 'activo') {
      baseFilters.push({ field: 'activo', operator: '==', value: true });
    } else if (estadoFilter === 'inactivo') {
      baseFilters.push({ field: 'activo', operator: '==', value: false });
    }

    return baseFilters;
  }, [categoriaId, estadoFilter]);

  // Paginación con filtros (solo cuando NO hay búsqueda activa)
  const {
    data: serviciosPaginados,
    isLoading: isLoadingPage,
    hasMore,
    hasPrevious,
    page,
    next,
    previous,
    refresh
  } = useServerPagination<Servicio>({
    collectionName: COLLECTIONS.SERVICIOS,
    filters,
    pageSize,
    orderByField: 'correo',
    orderDirection: 'asc',
  });

  // Modo fetchAll: cuando hay búsqueda activa O filtros client-side (ciclo/perfil)
  const [isLoadingFetchAll, setIsLoadingFetchAll] = useState(false);
  useEffect(() => {
    if (!isFetchAllMode) return;
    let cancelled = false;
    const load = async () => {
      setIsLoadingFetchAll(true);
      await fetchServicios();
      if (!cancelled) setIsLoadingFetchAll(false);
    };
    load();
    return () => { cancelled = true; };
  }, [isFetchAllMode, fetchServicios]);

  const fetchAllResults = useMemo((): Servicio[] => {
    if (!isFetchAllMode) return [];
    const q = searchTerm.trim().toLowerCase();
    return todosLosServicios.filter(s => {
      if (s.categoriaId !== categoriaId) return false;
      if (s.enReposo) return false; // Hide reposo services from Servicios module
      if (estadoFilter === 'activo' && !s.activo) return false;
      if (estadoFilter === 'inactivo' && s.activo) return false;
      const matchSearch = !isSearchMode ||
        (s.nombre ?? '').toLowerCase().includes(q) ||
        (s.correo ?? '').toLowerCase().includes(q);
      const matchCiclo = cicloFilter === 'todos' || s.cicloPago === cicloFilter;
      const perfilesLibres = (s.perfilesDisponibles || 0) - (s.perfilesOcupados || 0);
      const matchPerfil = perfilFilter === 'todos' ||
        (perfilFilter === 'con_disponibles' && perfilesLibres > 0) ||
        (perfilFilter === 'sin_disponibles' && perfilesLibres <= 0);
      return matchSearch && matchCiclo && matchPerfil;
    });
  }, [isFetchAllMode, isSearchMode, searchTerm, todosLosServicios, categoriaId, estadoFilter, cicloFilter, perfilFilter]);

  const isLoading = isFetchAllMode ? isLoadingFetchAll : isLoadingPage;
  const servicios = isFetchAllMode ? fetchAllResults : serviciosPaginados;

  const categoria = categorias.find(c => c.id === categoriaId);

  // Escuchar cuando se elimina un servicio desde otra página
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'servicio-deleted') {
        refresh();
      }
    };

    const handleServicioDeleted = () => {
      refresh();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('servicio-deleted', handleServicioDeleted);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('servicio-deleted', handleServicioDeleted);
    };
  }, [refresh]);

  // En modo fetchAll, los filtros ya están aplicados en fetchAllResults.
  // En modo paginación pura (sin filtros), no se necesita filtrado adicional.
  const serviciosFiltrados = servicios.filter(s => !s.enReposo);

  const handleEdit = (id: string) => {
    router.push(`/servicios/${id}/editar?from=/servicios/${categoriaId}`);
  };

  const handleView = (id: string) => {
    router.push(`/servicios/detalle/${id}?from=${encodeURIComponent(`/servicios/${categoriaId}`)}`);
  };

  if (!categoria) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Categoría no encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/servicios')}
              className="h-8 w-8 p-0 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Servicios: {categoria.nombre}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link> / <Link href="/servicios" className="hover:text-foreground transition-colors">Servicios</Link> / <span className="text-foreground">{categoria.nombre}</span>
          </p>
        </div>
        <Link href={`/servicios/crear?from=/servicios/${categoriaId}`} className="self-start sm:self-auto">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Servicio
          </Button>
        </Link>
      </div>

      <ServiciosCategoriaMetrics categoria={categoria} />

      <ServiciosCategoriaFilters
        estadoFilter={estadoFilter}
        onEstadoChange={setEstadoFilter}
      />

      <ServiciosCategoriaTableDetalle
        servicios={serviciosFiltrados}
        onEdit={handleEdit}
        onView={handleView}
        title="Todos los servicios"
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        cicloFilter={cicloFilter}
        onCicloChange={setCicloFilter}
        perfilFilter={perfilFilter}
        onPerfilChange={setPerfilFilter}
        isLoading={isLoading}
        hasMore={isFetchAllMode ? false : hasMore}
        hasPrevious={isFetchAllMode ? false : hasPrevious}
        page={isFetchAllMode ? 1 : page}
        showPagination={!isFetchAllMode}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        onNext={next}
        onPrevious={previous}
      />
    </div>
  );
}

export default function ServiciosCategoriaPage() {
  return (
    <ModuleErrorBoundary moduleName="Servicios">
      <ServiciosCategoriaPageContent />
    </ModuleErrorBoundary>
  );
}
