import type { Plan } from '@/types/categorias';

export const CICLOS_PAGO: Plan['cicloPago'][] = ['mensual', 'trimestral', 'semestral', 'anual'];

export const DECIMAL_INPUT_PATTERN = /^\d*\.?\d*$/;

export function getCicloPagoLabel(ciclo?: string) {
  return ciclo === 'mensual'
    ? 'Mensual'
    : ciclo === 'trimestral'
      ? 'Trimestral'
      : ciclo === 'semestral'
        ? 'Semestral'
        : ciclo === 'anual'
          ? 'Anual'
          : 'Seleccionar ciclo';
}

export function getCiclosDisponibles(categoriaPlanes?: Plan[], tipoPlan?: Plan['tipoPlan']) {
  const planes = categoriaPlanes
    ? categoriaPlanes.filter((plan) => !tipoPlan || plan.tipoPlan === tipoPlan)
    : [];

  return planes.length > 0
    ? CICLOS_PAGO.filter((ciclo) => planes.some((plan) => plan.cicloPago === ciclo))
    : CICLOS_PAGO;
}

export function getPrecioPorCiclo(
  ciclo: Plan['cicloPago'] | undefined,
  categoriaPlanes?: Plan[],
  tipoPlan?: Plan['tipoPlan']
) {
  if (!ciclo || !categoriaPlanes?.length) return null;

  const match = categoriaPlanes.find((plan) =>
    plan.cicloPago === ciclo && (!tipoPlan || plan.tipoPlan === tipoPlan)
  );

  return match?.precio ?? null;
}

interface PagoDialogCopyArgs {
  isEdit: boolean;
  isVenta: boolean;
  pagoDescripcion?: string;
  servicioNombre?: string;
  ventaClienteNombre?: string;
}

export function getPagoDialogCopy({
  isEdit,
  isVenta,
  pagoDescripcion,
  servicioNombre,
  ventaClienteNombre,
}: PagoDialogCopyArgs) {
  if (isVenta) {
    return {
      title: isEdit
        ? 'Editar Pago'
        : `Renovar Venta: ${ventaClienteNombre || ''}`,
      description: isEdit
        ? 'Actualiza la informaciÃ³n del pago seleccionado.'
        : 'Registre un nuevo pago para esta venta para extender su fecha de vencimiento.',
    };
  }

  return {
    title: isEdit
      ? `Editar pago del servicio: ${servicioNombre || ''}`
      : `Renovar Servicio: ${servicioNombre || ''}`,
    description: isEdit
      ? `Corrija los datos del Ãºltimo pago registrado (${pagoDescripcion ?? 'Pago'}) si se ingresÃ³ algo incorrecto.`
      : 'Registre un nuevo pago para este servicio para extender su fecha de vencimiento.',
  };
}
