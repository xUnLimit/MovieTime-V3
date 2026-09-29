'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

import { CategoriaForm } from '@/components/categorias/CategoriaForm';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCategoriaDetail } from '@/hooks/use-entity-detail';
import { isUuid, safeInternalPath } from '@/platform/utils/safety';
import { toast } from 'sonner';

function EditarCategoriaPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const from = safeInternalPath(searchParams.get('from'), '/categorias');
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = isUuid(rawId) ? rawId : null;
  const { data: categoria = null, isError, isLoading: loading } = useCategoriaDetail(id);

  useEffect(() => {
    if (!isError) return;
    toast.error('Error al cargar la categoría', {
      description: 'No se pudieron obtener los datos. Intenta nuevamente.',
    });
  }, [isError]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!categoria) {
    return (
      <div className="space-y-4">
        <PageHeader title="Categoría no encontrada" trail={[{ label: 'Editar' }]} />
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-muted-foreground">
            No se encontró la categoría con el ID proporcionado.
          </p>
          <Link prefetch={false}
            href="/categorias"
            className="inline-block mt-4 text-primary hover:underline"
          >
            Volver a Categorías
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Editar Categoría" trail={[{ label: 'Editar' }]} backTo={from} />

      {/* Form Card */}
      <div className="bg-card border rounded-lg p-6">
        <CategoriaForm mode="edit" categoria={categoria} returnTo={from} />
      </div>
    </div>
  );
}

export default function EditarCategoriaPage() {
  return (
    <ModuleErrorBoundary moduleName="Editar Categoría">
      <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Cargando...</div></div>}>
        <EditarCategoriaPageContent />
      </Suspense>
    </ModuleErrorBoundary>
  );
}
