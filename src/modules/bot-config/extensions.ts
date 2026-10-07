import type { BotConditionType, BotNode, BotOption } from '@/types/bot';
import { renderTemplate, templateVariables } from './render';

/**
 * Extensiones del recorrido (bandera de servidor `FLOW_EXTENSIONS_ENABLED`): condiciones cerradas que el servidor
 * resuelve con datos que ya existen y un conjunto cerrado de datos del pedido para los textos. Nada aqui admite
 * expresiones libres ni datos personales completos.
 */

export const CONDITION_CATALOG: Record<BotConditionType, { label: string; description: string; yes: string; no: string; body: string }> = {
  customer_has_services: {
    label: 'Cliente nuevo o existente',
    description: 'Existente: tiene al menos un servicio de Netflix activo. Nuevo: todavía no tiene ninguno.',
    yes: 'Existente', no: 'Nuevo', body: '¿Cómo continuamos?',
  },
  catalog_has_stock: {
    label: 'Servicio con o sin cupo',
    description: 'Con cupo: algún plan del catálogo tiene perfiles libres en este momento. Si no se puede consultar, se toma «sin cupo».',
    yes: 'Con cupo', no: 'Sin cupo', body: '¿Cómo continuamos?',
  },
};
export const CONDITION_TYPES = Object.keys(CONDITION_CATALOG) as BotConditionType[];
export const CONDITION_OPTION_IDS = { yes: 'si', no: 'no' } as const;
/** Condiciones seguidas que el servidor resuelve antes de mostrar un nodo; mas alla no se envia nada. */
export const MAX_CONDITION_HOPS = 5;
export type ConditionFacts = Record<BotConditionType, boolean>;

/** Opcion que corresponde a la respuesta de la condicion (`si` / `no`), si el nodo la tiene. */
export function conditionOption(node: BotNode, answer: boolean): BotOption | undefined {
  const id = answer ? CONDITION_OPTION_IDS.yes : CONDITION_OPTION_IDS.no;
  return node.options.find((option) => option.id === id);
}

export const FALLBACK_VALUE = '—';
const VALUE_MAX = 40;

/** Datos del pedido admitidos en los textos de los nodos: lista blanca cerrada, sin identificadores ni datos personales. */
export const NODE_VARIABLE_CATALOG: Record<string, { label: string; example: string }> = {
  pedido_total: { label: 'Total del pedido', example: '$12.50' },
  pedido_estado: { label: 'Estado del pago', example: 'pendiente de pago' },
  pedido_pendiente: { label: 'Monto que falta por pagar', example: '$12.50' },
  pedido_servicios: { label: 'Cantidad de servicios del pedido', example: '2' },
  pedido_vence: { label: 'Vencimiento de la reserva', example: 'hoy a las 10:42 p. m.' },
};
export const NODE_VARIABLE_NAMES = Object.keys(NODE_VARIABLE_CATALOG);

/** Marcadores de la lista blanca que usa un texto (sin repetir). */
export function nodeVariablesIn(body: string): string[] {
  return templateVariables(body).filter((name) => Object.hasOwn(NODE_VARIABLE_CATALOG, name));
}

/** Resuelve solo la lista blanca en una pasada; lo que falta o esta vacio muestra «—». Los demas marcadores quedan tal cual. */
export function renderNodeBody(body: string, values: Readonly<Record<string, string>>): string {
  const safe: Record<string, string> = {};
  for (const name of NODE_VARIABLE_NAMES) {
    const value = Object.hasOwn(values, name) ? values[name] : undefined;
    safe[name] = typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, VALUE_MAX) : FALLBACK_VALUE;
  }
  return renderTemplate(body, safe);
}

export function exampleNodeValues(): Record<string, string> {
  return Object.fromEntries(Object.entries(NODE_VARIABLE_CATALOG).map(([name, spec]) => [name, spec.example]));
}
