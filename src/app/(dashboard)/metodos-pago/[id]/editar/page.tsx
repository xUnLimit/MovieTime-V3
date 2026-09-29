'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

import { MetodoPagoForm } from '@/components/metodos-pago/MetodoPagoForm';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { useMetodoPagoDetail } from '@/hooks/use-entity-detail';
import { isUuid, safeInternalPath } from '@/platform/utils/safety';
import { toast } from 'sonner';

function EditarMetodoPagoPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const from = safeInternalPath(searchParams.get('from'), '/metodos-pago');
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = isUuid(rawId) ? rawId : null;
  const { data: metodoPago = null, isError, isLoading: loading } = useMetodoPagoDetail(id);

  useEffect(() => {
    if (!isError) return;
    toast.error('Error al cargar el método de pago', {
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

  if (!metodoPago) {
    return (
      <div className="space-y-4">
        <PageHeader title="Método de pago no encontrado" trail={[{ label: 'Editar' }]} />
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-muted-foreground">
            No se encontró el método de pago con el ID proporcionado.
          </p>
          <Link prefetch={false}
            href="/metodos-pago"
            className="inline-block mt-4 text-primary hover:underline"
          >
            Volver a Métodos de Pago
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Editar Método de Pago" trail={[{ label: 'Editar' }]} backTo={from} />

      {/* Form Card */}
      <div className="bg-card border rounded-lg p-6">
        <MetodoPagoForm mode="edit" metodoPago={metodoPago} returnTo={from} />
      </div>
    </div>
  );
}

export default function EditarMetodoPagoPage() {
  return (
    <ModuleErrorBoundary moduleName="Editar Método de Pago">
      <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Cargando...</div></div>}>
        <EditarMetodoPagoPageContent />
      </Suspense>
    </ModuleErrorBoundary>
  );
}
