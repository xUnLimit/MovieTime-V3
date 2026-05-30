'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { Button } from '@/components/ui/button';
import { VentasEditForm, type VentaEditData } from '@/components/ventas/VentasEditForm';
import { queryKeys } from '@/platform/query-keys';
import { getVentaConUltimoPagoUseCase } from '@/lib/use-cases/ventas/venta-current-payment-use-cases';
import { getVentaDetalleUseCase } from '@/lib/use-cases/ventas/ventas-query-use-cases';
import { isUuid } from '@/platform/utils/safety';
import { toast } from 'sonner';

async function fetchVentaEditData(id: string): Promise<VentaEditData | null> {
  const venta = await getVentaDetalleUseCase(id);
  if (!venta) return null;

  const ventaConDatos = await getVentaConUltimoPagoUseCase(venta);

  return {
    ...ventaConDatos,
    clienteId: ventaConDatos.clienteId || '',
    metodoPagoId: ventaConDatos.metodoPagoId || '',
    categoriaId: ventaConDatos.categoriaId || '',
    servicioId: ventaConDatos.servicioId || '',
    servicioCorreo: ventaConDatos.servicioCorreo || '',
    fechaInicio: ventaConDatos.fechaInicio || new Date(),
    fechaFin: ventaConDatos.fechaFin || new Date(),
  };
}

function EditarVentaPageContent() {
  const params = useParams();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = isUuid(rawId) ? rawId : null;
  const {
    data: venta = null,
    error,
    isError,
    isLoading,
  } = useQuery({
    queryKey: queryKeys.ventas.edit(id ?? 'invalid'),
    queryFn: () => fetchVentaEditData(id!),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!isError) return;
    console.error('Error cargando venta:', error);
    toast.error('Error cargando venta', {
      description: error instanceof Error ? error.message : undefined,
    });
  }, [error, isError]);

  if (!id) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Venta no encontrada</h1>
        <p className="text-sm text-muted-foreground">El ID de la venta no es valido.</p>
        <Link prefetch={false} href="/ventas" className="text-primary hover:underline">
          Volver a Ventas
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link prefetch={false} href={`/ventas/${id}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Editar Venta</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            <Link prefetch={false} href="/" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>{' '}
            /{' '}
            <Link prefetch={false} href="/ventas" className="hover:text-foreground transition-colors">
              Ventas
            </Link>{' '}
            /{' '}
            <Link prefetch={false} href={`/ventas/${id}`} className="hover:text-foreground transition-colors">
              Detalle
            </Link>{' '}
            / <span className="text-foreground">Editar</span>
          </p>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando venta...</p>
        ) : venta ? (
          <VentasEditForm venta={venta} />
        ) : (
          <p className="text-sm text-muted-foreground">No se encontró la venta solicitada.</p>
        )}
      </div>
    </div>
  );
}

export default function EditarVentaPage() {
  return (
    <ModuleErrorBoundary moduleName="Editar Venta">
      <EditarVentaPageContent />
    </ModuleErrorBoundary>
  );
}
