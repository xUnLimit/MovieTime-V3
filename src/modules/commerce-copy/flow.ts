import type { CopyStepId } from './catalog';

type FlowStep = { id: CopyStepId; title: string; description: string };

// Pasos de la conversacion de compras en el orden en que los vive el cliente. En el lienzo agrupan los textos de cada bloque.
export const FLOW_STEPS: readonly FlowStep[] = [
  { id: 'inicio', title: 'Atajos', description: 'Botón para pasar con una persona cuando el cliente tiene una selección guardada o escribe algo que el flujo no reconoce.' },
  { id: 'plataformas', title: 'Plataformas', description: 'Lista de plataformas que tienen cupo.' },
  { id: 'planes', title: 'Planes', description: 'Planes disponibles de la plataforma elegida.' },
  { id: 'agotados', title: 'Sin cupo', description: 'Lo agotado: el cliente puede dejar su interés para que le avisemos.' },
  { id: 'renovar', title: 'Renovar', description: 'El cliente elige cuáles de sus servicios renovar.' },
  { id: 'carrito', title: 'Carrito', description: 'Resumen de lo elegido y confirmación.' },
  { id: 'reserva', title: 'Reserva', description: 'El pedido queda reservado por un tiempo limitado.' },
  { id: 'pago', title: 'Pago y estado', description: 'Datos de pago, "Ya pagué" con los últimos 4 dígitos del código de Yappy, seguimiento del pedido y entrega del acceso.' },
  { id: 'servicios', title: 'Mis servicios', description: 'Lista de los servicios activos del cliente.' },
  { id: 'ayuda', title: 'Ayuda y avisos', description: 'Pasar con una persona, cancelar y respuestas cuando algo no aplica.' },
];

const stepOf = (id: CopyStepId) => FLOW_STEPS.find(step => step.id === id);
export const stepTitle = (id: CopyStepId) => stepOf(id)?.title ?? id;
export const stepDescription = (id: CopyStepId) => stepOf(id)?.description ?? '';
