import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import type { VentaItem } from '@/features/ventas/ventas-form-shared';
import { syncTerceroMetodoPago } from '@/lib/services/terceroMetodoPagoSyncService';
import type { Tercero, VentaDoc } from '@/types';

import {
  buildVentaCreateBatchInputs,
  getServicioIdsConPerfil,
} from './venta-create-submit-helpers';

type CreateVentaInput = Omit<VentaDoc, 'id' | 'createdAt' | 'updatedAt'>;
type MetodoPagoResumen = {
  nombre?: string;
  moneda?: string;
};

type UseVentaCreateSubmitParams = {
  clienteId: string | undefined;
  clienteSeleccionado: Tercero | undefined;
  createVenta: (venta: CreateVentaInput) => Promise<void>;
  editedMessage: string;
  estadoVenta: string | undefined;
  fechaFin: Date | undefined;
  fechaInicio: Date | undefined;
  items: VentaItem[];
  metodoPagoId: string | undefined;
  metodoPagoSeleccionado: MetodoPagoResumen | undefined;
  notifyCliente: boolean;
  onSaved: () => void;
  setPendingWhatsApp: (pending: {
    phone: string;
    message: string;
    title: string;
    description: string;
  }) => void;
  totalFinal: number;
  updatePerfilOcupado: (id: string, shouldIncrement: boolean) => Promise<void>;
};

export function useVentaCreateSubmit({
  clienteId,
  clienteSeleccionado,
  createVenta,
  editedMessage,
  estadoVenta,
  fechaFin,
  fechaInicio,
  items,
  metodoPagoId,
  metodoPagoSeleccionado,
  notifyCliente,
  onSaved,
  setPendingWhatsApp,
  totalFinal,
  updatePerfilOcupado,
}: UseVentaCreateSubmitParams) {
  const [saving, setSaving] = useState(false);

  const handleGuardarVenta = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (items.length === 0) {
      toast.error('Sin servicios', {
        description: 'Agrega al menos un servicio antes de guardar la venta.',
      });
      return;
    }
    if (!clienteId || !metodoPagoId || !fechaInicio || !fechaFin) {
      toast.error('Datos incompletos', {
        description: 'Completa todos los campos requeridos para guardar la venta.',
      });
      return;
    }

    const clienteNombre = clienteSeleccionado
      ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}`
      : 'Sin cliente';
    const metodoPagoNombre = metodoPagoSeleccionado?.nombre || 'Sin metodo';
    const moneda = metodoPagoSeleccionado?.moneda || 'USD';
    const normalizedEstado = estadoVenta === 'inactivo' ? 'inactivo' : 'activo';

    try {
      setSaving(true);
      const writes = buildVentaCreateBatchInputs({
        clienteId,
        clienteNombre,
        clienteTelefono: clienteSeleccionado?.telefono || '',
        estadoVenta: normalizedEstado,
        fechaFinValue: fechaFin,
        fechaInicioValue: fechaInicio,
        items,
        metodoPagoId,
        metodoPagoNombre,
        moneda,
        totalFinal,
      }).map((input) => createVenta(input));
      await Promise.all(writes);

      try {
        await syncTerceroMetodoPago({
          terceroId: clienteId,
          metodoPagoId,
          metodoPagoNombre,
          moneda,
        });
      } catch (syncError) {
        console.error('Error sincronizando metodo de pago del tercero:', syncError);
        toast.warning('Venta guardada con advertencia', {
          description:
            'La venta se creo, pero no se pudo actualizar el metodo de pago en terceros.',
        });
      }

      if (normalizedEstado !== 'inactivo') {
        const servicioIdsConPerfil = getServicioIdsConPerfil(items);
        await Promise.all(
          servicioIdsConPerfil.map((servicioId) =>
            updatePerfilOcupado(servicioId, true),
          ),
        );
      }
      if (notifyCliente && normalizedEstado !== 'inactivo' && editedMessage) {
        const phoneRaw = clienteSeleccionado?.telefono || '';
        const phone = phoneRaw.replace(/[^\d+]/g, '');
        setPendingWhatsApp({
          phone,
          message: editedMessage,
          title: 'Venta registrada',
          description: 'La venta ha sido guardada correctamente en el sistema.',
        });
      } else {
        toast.success('Venta registrada', {
          description: 'La venta ha sido guardada correctamente en el sistema.',
        });
      }
      onSaved();
    } catch (error) {
      console.error('Error guardando venta:', error);
      toast.error('Error al guardar la venta', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return {
    handleGuardarVenta,
    saving,
  };
}
