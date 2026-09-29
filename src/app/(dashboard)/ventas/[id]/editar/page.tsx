'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { VentasEditForm, type VentaEditData } from '@/components/ventas/VentasEditForm';
import { queryKeys } from '@/platform/query-keys';
import { getVentaConUltimoPagoUseCase } from '@/application/use-cases/ventas/venta-current-payment-use-cases';
import { getVentaDetalleUseCase } from '@/application/use-cases/ventas/ventas-query-use-cases';
import { reportError } from '@/platform/observability/logger';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
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
    reportError('EditarVentaPage', 'Error cargando venta', error);
    toast.error('Error cargando venta', {
      description: getPublicErrorMessage(error, 'No se pudo cargar la venta.'),
    });
  }, [error, isError]);

  if (!id) {
    return (
      <div className="space-y-4">
        <PageHeader title="Venta no encontrada" trail={[{ label: 'Editar' }]} />
        <p className="text-sm text-muted-foreground">El ID de la venta no es valido.</p>
        <Link prefetch={false} href="/ventas" className="text-primary hover:underline">
          Volver a Ventas
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar Venta"
        trail={[{ label: 'Detalle', href: `/ventas/${id}` }, { label: 'Editar' }]}
      />

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
