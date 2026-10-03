import { useRef, useState, type FormEvent } from 'react';
import { createMutationIntent } from '@/platform/utils/mutation-intent';
import { toast } from 'sonner';
import { announceNotice } from '@/components/shared/announce-notice';
import { useWhatsAppToastStore } from '@/store/whatsappToastStore';
import { notifyCommittedMutation } from '@/components/shared/notify-committed-mutation';
import { MutationCommittedError } from '@/platform/errors/mutation-committed-error';

import type { VentaItem } from '@/components/ventas/form/ventas-form-shared';
import { createCartSession } from '@/application/use-cases/ventas/create-ventas-from-cart-use-case';
import type { createVentasFromCartMutation } from '@/application/client-domain-mutations/ventas-client-mutations';
import { reportError } from '@/platform/observability/logger';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import type { Tercero } from '@/types';

import {
  buildVentaCreateBatchInputs,
} from './venta-create-submit-helpers';

type MetodoPagoResumen = {
  nombre?: string;
  moneda?: string;
};

type UseVentaCreateSubmitParams = {
  clienteId: string | undefined;
  clienteSeleccionado: Tercero | undefined;
  createCart: typeof createVentasFromCartMutation;
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
  createCart,
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
  const session = useRef(createCartSession());
  const finalized = useRef(new Set<string>());
  const enqueueWhatsAppMessages = useWhatsAppToastStore((state) => state.enqueueMany);

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
      });
      const key = intent.current.keyFor([items, clienteId, metodoPagoId, moneda, fechaInicio, fechaFin, normalizedEstado]);
      if (finalized.current.has(key)) return;
      const result = await createCart(writes, { idempotencyKey: key, session: session.current });
      batchCommitted = true;
      finalized.current.add(key);
      if (result.monedas.length > 1) toast.info('Carrito dividido por moneda', {
        description: `Se confirmo un pedido por moneda: ${result.monedas.join(', ')}.`,
      });
      if (result.sinStock.length) toast.warning('Items sin stock', {
        description: `Pendientes de entrega: ${result.sinStock.join(', ')}. El pedido conserva el cobro para conciliacion.`,
      });
      for (const warning of new Set(result.warnings)) toast.warning('Pedido guardado con advertencia', { description: warning });
      if (notifyCliente && normalizedEstado !== 'inactivo' && result.ventaIds.length > 0) {
        const pending = editedMessage ? {
          phone: (clienteSeleccionado?.telefono || '').replace(/[^\d+]/g, ''),
          message: editedMessage,
          title: 'Venta registrada',
          description: 'La venta ha sido guardada correctamente en el sistema.',
        } : null;
        await announceNotice({
          tipo: 'suscripcion',
          eventId: key,
          items: result.ventaIds.map(ventaId => ({ ventaId, message: pending })),
          enqueueWhatsAppMessages,
          copy: {
            loading: 'Venta registrada. Avisando al cliente...',
            sent: 'Venta registrada y cliente avisado por WhatsApp',
            notSent: 'Venta registrada, pero no se pudo avisar por la API',
            offerTitle: 'Venta registrada',
            offerDescription: 'Notificar al cliente',
          },
          onAutoDisabled: async () => {
            if (!pending) {
              toast.success('Venta registrada');
              return;
            }
            const sent = sendDirectMessage ? await sendDirectMessage(editedMessage) : null;
            if (sent?.ok) {
              toast.success('Venta registrada', {
                description: 'La venta se guardó y el mensaje se envió al cliente por WhatsApp.',
              });
            } else {
              if (sent && !sent.ok) {
                toast.warning('No se pudo enviar el mensaje automáticamente', { description: sent.reason });
              }
              setPendingWhatsApp(pending);
            }
          },
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
        description: getPublicErrorMessage(error, 'No se pudo confirmar el pedido. Reintenta con los mismos datos.'),
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
