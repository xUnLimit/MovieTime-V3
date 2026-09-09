import { useRef, useState, type FormEvent } from 'react';
import { createMutationIntent } from '@/platform/utils/mutation-intent';
import { toast } from 'sonner';
import { notifyCommittedMutation } from '@/components/shared/notify-committed-mutation';
import { MutationCommittedError } from '@/platform/errors/mutation-committed-error';

import type { VentaItem } from '@/features/ventas/ventas-form-shared';
import { syncTerceroMetodoPagoUseCase } from '@/application/use-cases/terceros/tercero-metodo-pago-use-cases';
import { reportError } from '@/platform/observability/logger';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
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
  createVenta: (venta: CreateVentaInput, idempotencyKey?: string) => Promise<void>;
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
  const submitting = useRef(false);
  const intent = useRef(createMutationIntent());
  const completed = useRef(new Set<string>());

  const handleGuardarVenta = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
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

    let batchCommitted = false;
    try {
      submitting.current = true;
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
      }).map(async (input, index) => {
        const key = intent.current.keyFor([
          items[index], clienteId, metodoPagoId, moneda, fechaInicio, fechaFin, normalizedEstado,
        ]);
        if (completed.current.has(key)) return;
        try {
          await createVenta(input, key);
        } catch (error) {
          if (!notifyCommittedMutation(error)) throw error;
          reportError('VentaCreateSubmit', 'Venta guardada con error secundario', error);
        }
        completed.current.add(key);
      });
      const results = await Promise.allSettled(writes);
      const failed = results.find((result) => result.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;
      batchCommitted = true;

      try {
        await syncTerceroMetodoPagoUseCase({
          terceroId: clienteId,
          metodoPagoId,
          metodoPagoNombre,
          moneda,
        });
      } catch (syncError) {
        reportError('VentaCreateSubmit', 'Error sincronizando metodo de pago del tercero', syncError);
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
      reportError('VentaCreateSubmit', 'Error guardando venta', error);
      if (batchCommitted) {
        notifyCommittedMutation(new MutationCommittedError('venta-batch', error));
        onSaved();
        return;
      }
      toast.error('Error al guardar la venta', {
        description: completed.current.size > 0
          ? 'Parte del lote ya se guardo. Reintenta sin cambiar los datos para completar las ventas pendientes sin duplicarlas.'
          : getPublicErrorMessage(error, 'No se pudo guardar la venta.'),
      });
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return {
    handleGuardarVenta,
    saving,
  };
}
