import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createTerceroMutation, updateTerceroMutation } from '@/application/client-domain-mutations';
import { queryKeys } from '@/platform/query-keys';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { getTerceroMetodoPagoMoneda, isPendingTerceroPaymentMethodId, PENDING_TERCERO_PAYMENT_NAME } from '@/platform/utils/terceroMetodoPago';
import type { MetodoPago, Tercero } from '@/types';
import type { TerceroFormData } from './tercero-form-values';

function formatearTelefono(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    const sinPlus = trimmed.slice(1);
    const digits = sinPlus.replace(/\D/g, "");
    if (digits.length > 8) {
      const countryCode = digits.slice(0, digits.length - 8);
      const local = digits.slice(digits.length - 8);
      return "+" + countryCode + " " + local.slice(0, 4) + "-" + local.slice(4);
    }
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 8) {
    return "+507 " + digits.slice(0, 4) + "-" + digits.slice(4);
  }
  return trimmed;
}

export async function submitTerceroForm(data: TerceroFormData, usuario: Tercero | null | undefined, metodosPago: MetodoPago[], queryClient: QueryClient, onSuccess?: () => void) {
    try {
      const metodoPago = isPendingTerceroPaymentMethodId(data.metodoPagoId)
        ? null
        : metodosPago.find((m) => m.id === data.metodoPagoId);

      const telefonoFormateado = formatearTelefono(data.telefono);

      const usuarioData = {
        nombre: data.nombre,
        apellido: data.apellido,
        tipo: data.tipoTercero,
        telefono: telefonoFormateado,
        metodoPagoId: data.metodoPagoId,
        metodoPagoNombre: metodoPago?.nombre || PENDING_TERCERO_PAYMENT_NAME,
        moneda: getTerceroMetodoPagoMoneda(
          data.metodoPagoId,
          metodoPago?.moneda,
        ),
        notas: data.notas?.trim() || "",
        active: true,
        createdBy: "current-user",
      };

      if (usuario) {
        // Actualizar tercero existente (incluyendo cambio de tipo si es necesario)
        await updateTerceroMutation(usuario.id, usuarioData, usuario);
        const cambioTipo = usuario.tipo !== data.tipoTercero;
        toast.success(
          cambioTipo
            ? "Tipo de tercero actualizado"
            : `${data.tipoTercero === "cliente" ? "Cliente" : "Revendedor"} actualizado`,
          {
            description: cambioTipo
              ? `El tercero ha sido convertido a ${data.tipoTercero} correctamente.`
              : "Los datos del tercero han sido actualizados correctamente.",
          },
        );
      } else {
        // Crear nuevo tercero
        await createTerceroMutation(usuarioData);
        toast.success(
          `${data.tipoTercero === "cliente" ? "Cliente" : "Revendedor"} creado`,
          {
            description: `El nuevo ${data.tipoTercero} ha sido registrado correctamente en el sistema.`,
          },
        );
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.terceros.all });
      onSuccess?.();
    } catch (error) {
      toast.error("Error al guardar tercero", {
        description: getPublicErrorMessage(error, "No se pudo guardar el tercero."),
      });
    }
}
