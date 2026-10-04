import { ValidationError } from '@/platform/errors/domain-errors';
import { toDateOnly } from '@/platform/supabase/dates';
import { createPedidoPanelUseCase } from '@/application/use-cases/pedidos-use-cases';
import type { PanelCart } from '@/modules/orders/contracts';
import { getUsdValues, type VentaInput } from './ventas-shared';

export async function createVentaBatchUseCase(inputs: VentaInput[], key: string): Promise<string> {
  const groups: PanelCart = [];
  for (const input of inputs) {
    if (!input.clienteId || !input.planId) throw new ValidationError('Selecciona cliente y plan para cada servicio.');
    const moneda = input.moneda ?? 'USD';
    let group = groups.find(candidate => candidate.moneda === moneda);
    if (!group) {
      const { rate } = await getUsdValues(1, moneda);
      group = { clienteId: input.clienteId, moneda, exchangeRate: rate, items: [] };
      groups.push(group);
    }
    group.items.push({
      planId: input.planId, servicioId: input.servicioId, perfilNumero: input.perfilNumero ?? null,
      descuento: input.descuento ?? 0, precio: input.precio ?? 0,
      cicloPago: input.cicloPago ?? 'mensual', fechaInicio: toDateOnly(input.fechaInicio), fechaFin: toDateOnly(input.fechaFin),
      estado: input.estado ?? 'activo', perfilNombre: input.perfilNombre ?? '', codigo: input.codigo ?? '', notas: input.notas ?? '',
      metodoPagoId: input.metodoPagoId || null, metodoPagoNombre: input.metodoPagoNombre ?? '',
    });
  }
  return createPedidoPanelUseCase(groups, key);
}
