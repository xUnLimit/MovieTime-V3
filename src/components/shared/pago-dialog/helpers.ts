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
