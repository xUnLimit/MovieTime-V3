import type { CopyKey, CopyStepId } from './catalog';
import { COPY_CATALOG } from './catalog';

export type FlowStep = { id: CopyStepId; title: string; description: string; next: readonly CopyStepId[] };

// Mapa de la conversacion de compras: pasos en el orden en que los vive el cliente y a donde puede ir desde cada uno.
export const FLOW_STEPS: readonly FlowStep[] = [
  { id: 'inicio', title: 'Inicio', description: 'El cliente saluda y ve el menú con lo que puede hacer.', next: ['plataformas', 'renovar', 'servicios', 'ayuda'] },
  { id: 'plataformas', title: 'Plataformas', description: 'Lista de plataformas que tienen cupo.', next: ['planes', 'agotados'] },
  { id: 'planes', title: 'Planes', description: 'Planes disponibles de la plataforma elegida.', next: ['plataformas', 'carrito'] },
  { id: 'agotados', title: 'Sin cupo', description: 'Lo agotado: el cliente puede dejar su interés para que le avisemos.', next: ['plataformas'] },
  { id: 'renovar', title: 'Renovar', description: 'El cliente elige cuáles de sus servicios renovar.', next: ['carrito'] },
  { id: 'carrito', title: 'Carrito', description: 'Resumen de lo elegido y confirmación.', next: ['reserva'] },
  { id: 'reserva', title: 'Reserva', description: 'El pedido queda reservado por un tiempo limitado.', next: ['pago'] },
  { id: 'pago', title: 'Pago y estado', description: 'Datos de pago, seguimiento del pedido y entrega del acceso.', next: [] },
  { id: 'servicios', title: 'Mis servicios', description: 'Lista de los servicios activos del cliente.', next: ['renovar'] },
  { id: 'ayuda', title: 'Ayuda y avisos', description: 'Pasar con una persona, cancelar y respuestas cuando algo no aplica.', next: [] },
];

export const stepTitle = (id: CopyStepId) => FLOW_STEPS.find(step => step.id === id)?.title ?? id;

export function copyKeysOfStep(id: CopyStepId): CopyKey[] {
  return (Object.keys(COPY_CATALOG) as CopyKey[]).filter(key => COPY_CATALOG[key].step === id);
}
