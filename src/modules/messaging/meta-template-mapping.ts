import type { MessageData } from './message-data';

export type MetaTemplateButton = { type: string; text: string };

export type MetaTemplateInfo = {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  body: string;
  header: string | null;
  footer: string | null;
  buttons: MetaTemplateButton[];
  paramCount: number;
  retired: boolean;
  syncedAt: string;
};

type MappableKey = 'saludo_nombre' | 'nombre_cliente' | 'servicios' | 'vencimiento' | 'monto_total' | 'perfil' | 'codigo';

export const DATA_KEY_OPTIONS: readonly { key: MappableKey; label: string }[] = [
  { key: 'saludo_nombre', label: 'Saludo y nombre' },
  { key: 'nombre_cliente', label: 'Nombre' },
  { key: 'servicios', label: 'Servicios' },
  { key: 'vencimiento', label: 'Vencimiento' },
  { key: 'monto_total', label: 'Monto total' },
  { key: 'perfil', label: 'Perfil' },
  { key: 'codigo', label: 'Código' },
];

export function dataKeyLabel(key: string): string {
  return DATA_KEY_OPTIONS.find((option) => option.key === key)?.label ?? key;
}

const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'APROBADA',
  PENDING: 'EN REVISIÓN',
  IN_APPEAL: 'EN REVISIÓN',
  REJECTED: 'RECHAZADA',
};

export function metaStatusLabel(status: string): string {
  return STATUS_LABELS[status.toUpperCase()] ?? status;
}

export function isUsableMetaTemplate(template: MetaTemplateInfo): boolean {
  return template.status === 'APPROVED' && !template.retired;
}

/** Ajusta el mapa a la cantidad de {{n}} de la plantilla, conservando lo ya elegido. */
export function resizeParamMap(map: readonly string[], paramCount: number): string[] {
  return Array.from({ length: paramCount }, (_, index) => map[index] ?? '');
}

/** Devuelve el problema del mapa, o null si es valido. Sin plantilla no hay nada que mapear. */
export function validateParamMap(map: readonly string[], template: Pick<MetaTemplateInfo, 'paramCount'> | null): string | null {
  if (!template) return null;
  if (map.length !== template.paramCount) {
    return `La plantilla usa ${template.paramCount} datos y el mapa tiene ${map.length}.`;
  }
  const missing = map.findIndex((key) => !DATA_KEY_OPTIONS.some((option) => option.key === key));
  if (missing >= 0) return `Elige un dato para {{${missing + 1}}}.`;
  return null;
}

export function renderMetaBody(body: string, params: readonly string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (match, index: string) => params[Number(index) - 1]?.trim() || match);
}

/** Valores tolerantes (vacio si falta el dato) para vistas previas y formularios editables. */
export function paramsFromData(map: readonly string[], data: MessageData): string[] {
  return map.map((key) => {
    const raw = (data as Record<string, unknown>)[key];
    return typeof raw === 'string' ? raw.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, 256) : '';
  });
}
