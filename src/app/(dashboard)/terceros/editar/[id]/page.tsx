'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { Button } from '@/components/ui/button';
import { TerceroForm } from '@/components/terceros/TerceroForm';
import { getTerceroUseCase } from '@/lib/use-cases/terceros-use-cases';
import { isUuid } from '@/lib/utils/safety';
import { useMetodosPagoStore } from '@/store/metodosPagoStore';
import type { Tercero, MetodoPago } from '@/types';
import { toast } from 'sonner';

function EditarTerceroPageContent() {
  const params = useParams();
  const router = useRouter();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = isUuid(rawId) ? rawId : null;
  const { fetchMetodosPagoTerceros } = useMetodosPagoStore();

  const [usuario, setTercero] = useState<Tercero | null>(null);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!id) {
        setLoading(false);
        setTercero(null);
        return;
      }
      setLoading(true);
      try {
        const [usuarioData, metodosData] = await Promise.all([
          getTerceroUseCase<Tercero>(id),
          fetchMetodosPagoTerceros()
        ]);

        setTercero(usuarioData);
        setMetodosPago(metodosData);
      } catch (error) {
        console.error('Error cargando datos:', error);
        toast.error('Error al cargar el tercero', { description: 'No se pudieron obtener los datos. Intenta nuevamente.' });
        setTercero(null);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, fetchMetodosPagoTerceros]);

  const tipoTercero = usuario?.tipo ?? 'cliente';

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




