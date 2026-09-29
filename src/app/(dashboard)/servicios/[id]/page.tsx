'use client';

import { useEffect, useMemo, useState } from 'react';
import { estimateInitialPageSize } from '@/hooks/useFitPageSize';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { ServiciosCategoriaFilters } from '@/components/servicios/ServiciosCategoriaFilters';
import { ServiciosCategoriaMetrics } from '@/components/servicios/ServiciosCategoriaMetrics';
import { ServiciosCategoriaTableDetalle } from '@/components/servicios/ServiciosCategoriaTableDetalle';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { useCategoriasFull } from '@/hooks/use-categorias-full';
import { useServerPagination } from '@/hooks/useServerPagination';
import { subscribeToServicioCategoryListReactions } from '@/platform/events/cache-reactions';
import { SERVICIOS_COLLECTION } from '@/application/use-cases/servicios/servicios-query-use-cases';
import { isUuid } from '@/platform/utils/safety';
import { Servicio } from '@/types';
import type { FilterOption } from '@/types/pagination';

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
  const [pageSize, setPageSize] = useState(() => estimateInitialPageSize(54));
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

  useEffect(() => {
    return subscribeToServicioCategoryListReactions(refresh);
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
      <PageHeader
        title={`Servicios: ${categoria.nombre}`}
        trail={[{ label: categoria.nombre }]}
        actions={
          <Button asChild className="whitespace-nowrap">
            <Link prefetch={false} href={`/servicios/crear?from=/servicios/${categoriaId}`}>
              <Plus />
              Nuevo Servicio
            </Link>
          </Button>
        }
      />

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
