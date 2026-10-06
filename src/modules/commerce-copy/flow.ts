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

type Side = 'left' | 'right' | 'top' | 'bottom';
/** Posición de un paso en el diagrama (columna y fila de una cuadrícula) y las flechas entre pasos, con el lado de salida y de llegada. */
export const PURCHASE_DIAGRAM: {
  positions: Readonly<Record<CopyStepId, { column: number; row: number }>>;
  edges: readonly { from: CopyStepId; to: CopyStepId; label: string; out: Side; in: Side }[];
} = {
  positions: {
    plataformas: { column: 0, row: 0 }, planes: { column: 1, row: 0 }, carrito: { column: 2, row: 0 }, reserva: { column: 3, row: 0 }, pago: { column: 4, row: 0 },
    agotados: { column: 1, row: 1 }, renovar: { column: 2, row: 1 }, ayuda: { column: 4, row: 1 }, inicio: { column: 3, row: 1 },
    servicios: { column: 0, row: 2 },
  },
  edges: [
    { from: 'plataformas', to: 'planes', label: 'Elige una plataforma', out: 'right', in: 'left' },
    { from: 'plataformas', to: 'agotados', label: 'Consultar agotados', out: 'bottom', in: 'left' },
    { from: 'planes', to: 'carrito', label: 'Revisar carrito', out: 'right', in: 'left' },
    { from: 'planes', to: 'agotados', label: 'Plan sin cupo', out: 'bottom', in: 'top' },
    { from: 'renovar', to: 'carrito', label: 'Revisar carrito', out: 'top', in: 'bottom' },
    { from: 'carrito', to: 'reserva', label: 'Confirmar selección', out: 'right', in: 'left' },
    { from: 'reserva', to: 'pago', label: 'Cómo pagar', out: 'right', in: 'left' },
    { from: 'pago', to: 'ayuda', label: 'Hablar con alguien', out: 'bottom', in: 'top' },
  ],
};
