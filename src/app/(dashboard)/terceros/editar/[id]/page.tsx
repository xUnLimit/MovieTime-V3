'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { TerceroForm } from '@/components/terceros/TerceroForm';
import { useTerceroDetail } from '@/hooks/use-entity-detail';
import { useMetodosPagoTerceros } from '@/hooks/use-metodos-pago-terceros';
import { isUuid } from '@/platform/utils/safety';
import { toast } from 'sonner';

function EditarTerceroPageContent() {
  const params = useParams();
  const router = useRouter();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = isUuid(rawId) ? rawId : null;
  const {
    data: usuario = null,
    isError: isUsuarioError,
    isLoading: isUsuarioLoading,
  } = useTerceroDetail(id);
  const {
    data: metodosPago = [],
    isError: isMetodosPagoError,
    isLoading: isMetodosPagoLoading,
  } = useMetodosPagoTerceros({ enabled: Boolean(id) });

  useEffect(() => {
    if (!isUsuarioError && !isMetodosPagoError) return;
    toast.error('Error al cargar el tercero', {
      description: 'No se pudieron obtener los datos. Intenta nuevamente.',
    });
  }, [isMetodosPagoError, isUsuarioError]);

  const tipoTercero = usuario?.tipo ?? 'cliente';
  const loading = isUsuarioLoading || isMetodosPagoLoading;

  const handleSuccess = () => {
    if (!id) return;
    router.push(`/terceros/${id}`);
  };

  const handleCancel = () => {
    if (!id) return;
    router.push(`/terceros/${id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="space-y-4">
        <PageHeader title="Tercero no encontrado" trail={[{ label: 'Editar' }]} />
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-muted-foreground">
            No se encontró el tercero con el ID proporcionado.
          </p>
          <Link prefetch={false}
            href="/terceros"
            className="inline-block mt-4 text-primary hover:underline"
          >
            Volver a Terceros
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Editar ${tipoTercero === 'cliente' ? 'Cliente' : 'Revendedor'}`}
        trail={[{ label: usuario?.nombre || 'Detalle', href: `/terceros/${id}` }, { label: 'Editar' }]}
      />

      <div className="bg-card border border-border rounded-lg p-6">
        <TerceroForm
          usuario={usuario}
          tipoInicial={tipoTercero}
          metodosPago={metodosPago}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          isPage={true}
        />
      </div>
    </div>
  );
}

export default function EditarTerceroPage() {
  return (
    <ModuleErrorBoundary moduleName="Editar Tercero">
      <EditarTerceroPageContent />
    </ModuleErrorBoundary>
  );
}




