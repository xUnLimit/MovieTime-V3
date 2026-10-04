import { useRef, useState, type FormEvent } from 'react';
import { createMutationIntent } from '@/platform/utils/mutation-intent';
import { toast } from 'sonner';
import { notifyCommittedMutation } from '@/components/shared/notify-committed-mutation';
import { MutationCommittedError } from '@/platform/errors/mutation-committed-error';

import type { VentaItem } from '@/components/ventas/form/ventas-form-shared';
import { syncTerceroMetodoPagoUseCase } from '@/application/use-cases/terceros/tercero-metodo-pago-use-cases';
import { reportError } from '@/platform/observability/logger';
import { createVentaBatchUseCase } from '@/application/use-cases/ventas/venta-batch-use-case';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import type { Tercero } from '@/types';

import { buildVentaCreateBatchInputs } from './venta-create-submit-helpers';

type MetodoPagoResumen = {
  nombre?: string;
  moneda?: string;
};

type UseVentaCreateSubmitParams = {
  clienteId: string | undefined;
  clienteSeleccionado: Tercero | undefined;
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
  // Cuando el formulario se usa embebido en un chat de WhatsApp ya abierto,
  // permite enviar la notificacion directo por la Cloud API en vez de
  // abrir WhatsApp Web en una pestana aparte. Si no se provee, o si el
  // envio directo no aplica (p. ej. ventana de 24h cerrada), se usa el
  // flujo por defecto (setPendingWhatsApp).
  sendDirectMessage?: (message: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
  totalFinal: number;
};

export function useVentaCreateSubmit({
  clienteId,
  clienteSeleccionado,
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
  sendDirectMessage,
  totalFinal,
}: UseVentaCreateSubmitParams) {
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const intent = useRef(createMutationIntent());

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
      const inputs = buildVentaCreateBatchInputs({
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
      });
      const key = intent.current.keyFor([items, clienteId, metodoPagoId, moneda, fechaInicio, fechaFin, normalizedEstado]);
      try {
        await createVentaBatchUseCase(inputs, key);
      } catch (error) {
        if (!notifyCommittedMutation(error)) throw error;
      }
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

      if (notifyCliente && normalizedEstado !== 'inactivo' && editedMessage) {
        const sent = sendDirectMessage ? await sendDirectMessage(editedMessage) : null;
        if (sent?.ok) {
          toast.success('Venta registrada', {
            description: 'La venta se guardó y el mensaje se envió al cliente por WhatsApp.',
          });
        } else {
          if (sent && !sent.ok) {
            toast.warning('No se pudo enviar el mensaje automáticamente', { description: sent.reason });
          }
          const phoneRaw = clienteSeleccionado?.telefono || '';
          const phone = phoneRaw.replace(/[^\d+]/g, '');
          setPendingWhatsApp({
            phone,
            message: editedMessage,
            title: 'Venta registrada',
            description: 'La venta ha sido guardada correctamente en el sistema.',
          });
        }
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
        description: getPublicErrorMessage(error, 'No se pudo guardar la venta.'),
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
