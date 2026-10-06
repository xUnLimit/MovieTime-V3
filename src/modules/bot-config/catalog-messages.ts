import { COPY_VARIABLES, copyMarkers, renderCopyText } from '@/modules/commerce-copy';
import type { BotCatalogMessages, BotDefinition, BotIssue } from '@/types/bot';

/**
 * Mensajes propios de una plataforma o de un plan, guardados en la definición del bot (se publican con ella). Si un servicio
 * no tiene el suyo, el bot usa el texto general del flujo de compra. Los marcadores permitidos son los de `COPY_VARIABLES`.
 */
export type CatalogScope = 'category' | 'plan';
export type CatalogField = 'chosen' | 'rowDescription' | 'added';
type VariableName = keyof typeof COPY_VARIABLES;

type FieldSpec = { label: string; when: string; maxLength: number; multiline: boolean; variables: readonly VariableName[]; fallback: string };

export const CATALOG_MESSAGE_FIELDS: Record<CatalogScope, Partial<Record<CatalogField, FieldSpec>>> = {
  category: {
    chosen: { label: 'Al elegir la plataforma', when: 'El cliente toca esta plataforma en la lista y ve sus planes', maxLength: 900, multiline: true,
      variables: ['plataforma'], fallback: 'Estos son los planes de {{plataforma}}. ¿Cuál prefieres?' },
    rowDescription: { label: 'Descripción en la lista de plataformas', when: 'Línea bajo el nombre de esta plataforma en la lista', maxLength: 72, multiline: false,
      variables: ['plataforma', 'cantidad', 'precio'], fallback: '{{cantidad}} planes · desde {{precio}}' },
  },
  plan: {
    added: { label: 'Al elegir el plan', when: 'El cliente agrega este plan a su selección', maxLength: 600, multiline: true,
      variables: ['servicio', 'plataforma', 'precio', 'ciclo'], fallback: 'Listo, agregué {{servicio}} a tu selección.' },
    rowDescription: { label: 'Descripción en la lista de planes', when: 'Línea bajo el nombre de este plan en la lista', maxLength: 72, multiline: false,
      variables: ['servicio', 'plataforma', 'precio', 'ciclo'], fallback: '{{precio}} · {{ciclo}}' },
  },
};

/** Tope de servicios con mensaje propio por tipo: la definición completa no puede pasar de 256 KB. */
export const MAX_CATALOG_ENTRIES = 200;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

const specOf = (scope: CatalogScope, field: CatalogField): FieldSpec | undefined => CATALOG_MESSAGE_FIELDS[scope][field];

/** Motivo por el que el texto no sirve en ese campo; null si es válido. */
export function catalogMessageProblem(scope: CatalogScope, field: CatalogField, text: string): string | null {
  const spec = specOf(scope, field);
  if (!spec) return 'Este mensaje no existe para este tipo de servicio.';
  const value = text.trim();
  if (!value) return 'El texto no puede estar vacío.';
  if (value.length > spec.maxLength) return `Máximo ${spec.maxLength} caracteres.`;
  if (!spec.multiline && /[\r\n]/.test(value)) return 'Debe ir en una sola línea.';
  const unknown = copyMarkers(value).find((name) => !(spec.variables as readonly string[]).includes(name));
  return unknown ? `El dato {{${unknown}}} no se puede usar en este mensaje.` : null;
}

/** Texto propio del servicio con sus datos, o `null` si no tiene uno válido (el bot usa entonces el general). */
export function resolveCatalogMessage(
  messages: BotCatalogMessages | undefined, scope: CatalogScope, id: string, field: CatalogField, values: Record<string, string>,
): string | null {
  const entries: Record<string, Partial<Record<CatalogField, string>> | undefined> | undefined = scope === 'category' ? messages?.categories : messages?.plans;
  const text = entries?.[id]?.[field];
  if (typeof text !== 'string' || catalogMessageProblem(scope, field, text) !== null) return null;
  const rendered = renderCopyText(text.trim(), values).trim();
  return rendered === '' ? null : rendered;
}

export function getCatalogMessage(def: BotDefinition, scope: CatalogScope, id: string, field: CatalogField): string | undefined {
  const entries: Record<string, Partial<Record<CatalogField, string>> | undefined> | undefined = scope === 'category' ? def.catalogMessages?.categories : def.catalogMessages?.plans;
  return entries?.[id]?.[field];
}

/** Guarda o quita (`null` o vacío) un mensaje propio. No cambia nada si el id, el campo o el tope no lo permiten. */
export function setCatalogMessage(def: BotDefinition, scope: CatalogScope, id: string, field: CatalogField, text: string | null): BotDefinition {
  if (!ID.test(id) || !specOf(scope, field)) return def;
  const current = def.catalogMessages ?? { categories: {}, plans: {} };
  const group: Record<string, Partial<Record<CatalogField, string>>> = { ...(scope === 'category' ? current.categories : current.plans) };
  const entry = { ...group[id] };
  if (text === null || text.trim() === '') delete entry[field];
  else entry[field] = text;
  if (Object.keys(entry).length === 0) delete group[id];
  else if (!(id in group) && Object.keys(group).length >= MAX_CATALOG_ENTRIES) return def;
  else group[id] = entry;
  const next: BotCatalogMessages = { ...current, [scope === 'category' ? 'categories' : 'plans']: group };
  const empty = Object.keys(next.categories).length === 0 && Object.keys(next.plans).length === 0;
  const rest = { ...def };
  delete rest.catalogMessages;
  return empty ? rest : { ...rest, catalogMessages: next };
}

/** Cuántos mensajes propios tiene una plataforma (con los de sus planes si se indican). */
export function countCatalogMessages(def: BotDefinition, categoryId: string, planIds: readonly string[] = []): number {
  const own = Object.keys(def.catalogMessages?.categories[categoryId] ?? {}).length;
  return own + planIds.reduce((sum, planId) => sum + Object.keys(def.catalogMessages?.plans[planId] ?? {}).length, 0);
}

/** Problemas de los mensajes por servicio: cada texto debe cumplir las reglas de su campo. */
export function catalogMessageIssues(def: BotDefinition): BotIssue[] {
  const issues: BotIssue[] = [];
  const messages = def.catalogMessages;
  if (!messages) return issues;
  for (const scope of ['category', 'plan'] as const) {
    const entries = scope === 'category' ? messages.categories : messages.plans;
    const groupName = scope === 'category' ? 'categories' : 'plans';
    if (Object.keys(entries).length > MAX_CATALOG_ENTRIES) {
      issues.push({ path: `catalogMessages.${groupName}`, message: `Máximo ${MAX_CATALOG_ENTRIES} servicios con mensaje propio.`, severity: 'error' });
    }
    for (const [id, fields] of Object.entries(entries)) {
      for (const [field, text] of Object.entries(fields as Record<string, string>)) {
        const problem = catalogMessageProblem(scope, field as CatalogField, text);
        if (problem) issues.push({ path: `catalogMessages.${groupName}[${id}].${field}`, message: problem, severity: 'error' });
      }
    }
  }
  return issues;
}
