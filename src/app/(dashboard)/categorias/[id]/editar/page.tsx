'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { CategoriaForm } from '@/components/categorias/CategoriaForm';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { Button } from '@/components/ui/button';
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
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Categoría no encontrada</h1>
          <p className="text-sm text-muted-foreground">
            <Link prefetch={false} href="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>{' '}
            /{' '}
            <Link prefetch={false} href="/categorias" className="hover:text-foreground transition-colors">
              Categorías
            </Link>{' '}
            / <span className="text-foreground">Editar</span>
          </p>
        </div>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link prefetch={false} href={from}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Editar Categoría</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            <Link prefetch={false} href="/" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>{' '}
            /{' '}
            <Link prefetch={false} href="/categorias" className="hover:text-foreground transition-colors">
              Categorías
            </Link>{' '}
            / <span className="text-foreground">Editar</span>
          </p>
        </div>
      </div>

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
