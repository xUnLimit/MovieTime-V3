export const ESTADO_FILTER_OPTIONS = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'proximas', label: 'Próximas a vencer' },
  { value: 'dia_pago', label: 'Día de pago' },
  { value: 'vencidas', label: 'Vencidas' },
] as const;

export const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

export { getBellIconColor, getEstadoBadge } from '@/components/shared/vencimiento-status';

export function formatearFecha(fecha: Date): string {
  const meses = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];

  const dia = fecha.getDate();
  const mes = meses[fecha.getMonth()];
  const anio = fecha.getFullYear();

  return `${dia} de ${mes} del ${anio}`;
}
