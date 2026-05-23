'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';

import { ServiciosCategoriaFilters } from '@/components/servicios/ServiciosCategoriaFilters';
import { ServiciosCategoriaMetrics } from '@/components/servicios/ServiciosCategoriaMetrics';
import { ServiciosCategoriaTableDetalle } from '@/components/servicios/ServiciosCategoriaTableDetalle';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { Button } from '@/components/ui/button';
import { useCategoriasFull } from '@/hooks/use-categorias-full';
import { useServerPagination } from '@/hooks/useServerPagination';
import { storeEventBus } from '@/lib/events/store-event-bus';
import { SERVICIOS_COLLECTION } from '@/lib/use-cases/servicios-use-cases';
import { isUuid } from '@/lib/utils/safety';
import { Servicio } from '@/types';
import type { FilterOption } from '@/lib/supabase/pagination';

function ServiciosCategoriaPageContent() {
  const params = useParams();
  const router = useRouter();
  const rawCategoriaId = Array.isArray(params.id) ? params.id[0] : params.id;
  const categoriaId = isUuid(rawCategoriaId) ? rawCategoriaId : null;

  const { data: categorias = [] } = useCategoriasFull();

  const [searchTerm, setSearchTerm] = useState('');
  const [cicloFilter, setCicloFilter] = useState('todos');
  const [perfilFilter, setPerfilFilter] = useState('todos');
  const [estadoFilter, setEstadoFilter] = useState('activo');
  const [pageSize, setPageSize] = useState(10);
  const isSearchMode = searchTerm.trim().length > 0;

  // Construir filtros dinámicos
  const filters = useMemo(() => {
    if (!categoriaId) return [];

    const baseFilters: FilterOption[] = [
      { field: 'categoriaId', operator: '==', value: categoriaId },
      { field: 'enReposo', operator: '==', value: false },
    ];

    if (estadoFilter === 'activo') {
      baseFilters.push({ field: 'activo', operator: '==', value: true });
    } else if (estadoFilter === 'inactivo') {
      baseFilters.push({ field: 'activo', operator: '==', value: false });
    }

    if (cicloFilter !== 'todos') {
      baseFilters.push({ field: 'cicloPago', operator: '==', value: cicloFilter });
    }

    if (perfilFilter === 'con_disponibles') {
      baseFilters.push({ field: 'perfilesLibres', operator: '>', value: 0 });
    } else if (perfilFilter === 'sin_disponibles') {
      baseFilters.push({ field: 'perfilesLibres', operator: '<=', value: 0 });
    }

    if (isSearchMode) {
      baseFilters.push({
        field: '__search__',
        operator: 'orIlike',
        value: {
          fields: ['nombre', 'correo'],
          value: searchTerm,
        },
      });
    }

    return baseFilters;
  }, [categoriaId, cicloFilter, estadoFilter, isSearchMode, perfilFilter, searchTerm]);

  // Paginación con filtros y búsqueda en SQL.
  const {
    data: serviciosPaginados,
    isLoading: isLoadingPage,
    hasMore,
    hasPrevious,
    page,
    totalPages,
    next,
    previous,
    refresh
  } = useServerPagination<Servicio>({
    collectionName: SERVICIOS_COLLECTION,
    filters,
    pageSize,
    orderByField: 'correo',
    orderDirection: 'asc',
    enabled: Boolean(categoriaId),
    includeTotalCount: true,
  });

  const isLoading = isLoadingPage;
  const servicios = serviciosPaginados;

  const categoria = categoriaId ? categorias.find(c => c.id === categoriaId) : undefined;

  // Escuchar cuando se elimina un servicio desde otra página
  useEffect(() => {
    const unsubscribe = storeEventBus.on('SERVICIO_DELETED', () => {
      refresh();
    });

    return unsubscribe;
  }, [refresh]);

  const handleEdit = (id: string) => {
    if (!categoriaId) return;
    router.push(`/servicios/${id}/editar?from=/servicios/${categoriaId}`);
  };

  const handleView = (id: string) => {
    if (!categoriaId) return;
    router.push(`/servicios/detalle/${id}?from=${encodeURIComponent(`/servicios/${categoriaId}`)}`);
  };

  if (!categoriaId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Categoria no encontrada</p>
      </div>
    );
  }

  if (!categoria) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Categoría no encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/servicios')}
              className="h-8 w-8 p-0 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="min-w-0 text-xl sm:text-2xl font-bold tracking-tight">Servicios: {categoria.nombre}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link prefetch={false} href="/" className="hover:text-foreground transition-colors">Dashboard</Link> / <Link prefetch={false} href="/servicios" className="hover:text-foreground transition-colors">Servicios</Link> / <span className="text-foreground">{categoria.nombre}</span>
          </p>
        </div>
        <Link prefetch={false} href={`/servicios/crear?from=/servicios/${categoriaId}`} className="shrink-0">
          <Button className="whitespace-nowrap">
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
        servicios={servicios}
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
        hasMore={hasMore}
        hasPrevious={hasPrevious}
        page={page}
        totalPages={totalPages}
        showPagination
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
