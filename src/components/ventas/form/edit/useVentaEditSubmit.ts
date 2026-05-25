import { toast } from 'sonner';

import { invalidateDashboardCache } from '@/lib/commands/client-cache';
import { updateVentaWithLatestPagoUseCase } from '@/lib/use-cases/ventas/ventas-payment-use-cases';
import type { Categoria, MetodoPago, Servicio, Tercero, VentaDoc } from '@/types';

import type { VentaEditData } from './types';
import {
  buildVentaEditPayload,
} from './venta-edit-controller-helpers';
import type { VentaEditFormData } from '@/features/ventas/venta-edit-form-schema';
import type { UseFormSetError } from 'react-hook-form';

type MetodoPagoEditResumen = Pick<MetodoPago, 'id' | 'nombre' | 'moneda'>;

type UseVentaEditSubmitParams = {
  categorias: Categoria[];
  clienteSeleccionado: Tercero | undefined;
  metodoPagoSeleccionado: MetodoPagoEditResumen | undefined;
  onSaved: () => void;
  serviciosCategoria: Servicio[];
  setError: UseFormSetError<VentaEditFormData>;
  updatePerfilOcupado: (id: string, shouldIncrement: boolean) => Promise<void>;
  venta: VentaEditData;
};

export function useVentaEditSubmit({
  categorias,
  clienteSeleccionado,
  metodoPagoSeleccionado,
  onSaved,
  serviciosCategoria,
  setError,
  updatePerfilOcupado,
  venta,
}: UseVentaEditSubmitParams) {
  const onSubmit = async (data: VentaEditFormData) => {
    try {
      const servicio = serviciosCategoria.find((item) => item.id === data.servicioId);
      const categoria = categorias.find((item) => item.id === data.categoriaId);
      const { pagoUpdates, plan, ventaUpdates } = buildVentaEditPayload({
        categoria,
        clienteSeleccionado,
        data,
        metodoPagoSeleccionado,
        servicio,
        venta,
      });
      if (!plan) {
        setError('planId', { type: 'manual', message: 'Seleccione un plan valido' });
        return;
      }
      const { syncPaymentMethodFailed } = await updateVentaWithLatestPagoUseCase(
        venta.id,
        ventaUpdates,
        pagoUpdates,
        {
          currentVenta: venta as VentaDoc,
          logContext: { usuarioId: 'sistema', usuarioEmail: 'sistema' },
        },
      );

      if (syncPaymentMethodFailed) {
        toast.warning('Venta actualizada con advertencia', {
          description:
            'La venta se guardo, pero no se pudo actualizar el metodo de pago en terceros.',
        });
      }

      const prevPerfil = venta.perfilNumero ?? null;
      const nextPerfil = Number(data.perfilNumero) || null;
      const prevServicioId = venta.servicioId;
      const nextServicioId = data.servicioId;
      const prevActivo = (venta.estado ?? 'activo') !== 'inactivo' && !!prevPerfil;
      const nextActivo = (data.estado ?? 'activo') !== 'inactivo' && !!nextPerfil;

      if (prevActivo && !nextActivo) {
        await updatePerfilOcupado(prevServicioId, false);
      } else if (!prevActivo && nextActivo) {
        await updatePerfilOcupado(nextServicioId, true);
      } else if (prevActivo && nextActivo && prevServicioId !== nextServicioId) {
        await Promise.all([
          updatePerfilOcupado(prevServicioId, false),
          updatePerfilOcupado(nextServicioId, true),
        ]);
      }

      invalidateDashboardCache({ entity: 'venta', entityId: venta.id });

      toast.success('Venta actualizada', {
        description: 'Los datos de la venta han sido guardados correctamente.',
      });
      onSaved();
    } catch (error) {
      console.error('Error actualizando venta:', error);
      toast.error('Error al actualizar la venta', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return {
    onSubmit,
  };
}
