import { useRef, useState, type FormEvent } from 'react';
import { createMutationIntent } from '@/platform/utils/mutation-intent';
import { toast } from 'sonner';
import { announceNotice } from '@/components/shared/announce-notice';
import { useWhatsAppToastStore } from '@/store/whatsappToastStore';
import { notifyCommittedMutation } from '@/components/shared/notify-committed-mutation';
import { MutationCommittedError } from '@/platform/errors/mutation-committed-error';

import type { VentaItem } from '@/components/ventas/form/ventas-form-shared';
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
  createVenta: (venta: CreateVentaInput, idempotencyKey?: string) => Promise<string>;
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
  sendDirectMessage,
  totalFinal,
  updatePerfilOcupado,
}: UseVentaCreateSubmitParams) {
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const intent = useRef(createMutationIntent());
  const completed = useRef(new Set<string>());
  const createdIds = useRef(new Map<string, string>());
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
      const batchKeys: string[] = [];
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
        batchKeys.push(key);
        if (completed.current.has(key)) return;
        try {
          const ventaId = await createVenta(input, key);
          createdIds.current.set(key, ventaId);
        } catch (error) {
          if (!notifyCommittedMutation(error)) throw error;
          if (error instanceof MutationCommittedError) createdIds.current.set(key, error.operationId);
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
      if (notifyCliente && normalizedEstado !== 'inactivo') {
        const pending = editedMessage ? {
          phone: (clienteSeleccionado?.telefono || '').replace(/[^\d+]/g, ''),
          message: editedMessage,
          title: 'Venta registrada',
          description: 'La venta ha sido guardada correctamente en el sistema.',
        } : null;
        await announceNotice({
          tipo: 'suscripcion',
          items: batchKeys.flatMap((key) => {
            const ventaId = createdIds.current.get(key);
            return ventaId ? [{ ventaId, message: pending }] : [];
          }),
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
