'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { Button } from '@/components/ui/button';
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
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tercero no encontrado</h1>
          <p className="text-sm text-muted-foreground">
            <Link prefetch={false} href="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>{' '}
            /{' '}
            <Link prefetch={false} href="/terceros" className="hover:text-foreground transition-colors">
              Terceros
            </Link>{' '}
            / <span className="text-foreground">Editar</span>
          </p>
        </div>
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
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link prefetch={false} href={`/terceros/${id}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Editar {tipoTercero === 'cliente' ? 'Cliente' : 'Revendedor'}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            <Link prefetch={false} href="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>{' '}
            /{' '}
            <Link prefetch={false} href="/terceros" className="hover:text-foreground transition-colors">
              Terceros
            </Link>{' '}
            /{' '}
            <Link prefetch={false} href={`/terceros/${id}`} className="hover:text-foreground transition-colors">
              {usuario?.nombre || 'Detalle'}
            </Link>{' '}
            / <span className="text-foreground">Editar</span>
          </p>
        </div>
      </div>

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




