import type { BotDefinition, BotNode } from '@/types/bot';
import { CATALOG_MESSAGE_FIELDS, type CatalogField, type CatalogScope } from './catalog-messages';
import { MESSAGE_CATALOG, MESSAGE_KEYS, PARAM_CATALOG, PARAM_KEYS } from './catalog';

function describeNodeChanges(before: BotNode, after: BotNode): string[] {
  const label = `Nodo «${after.name}»`;
  const changes: string[] = [];
  if (before.name !== after.name) changes.push(`${label}: nombre cambiado de «${before.name}»`);
  if (before.kind !== after.kind) changes.push(`${label}: tipo cambiado de ${before.kind} a ${after.kind}`);
  if (before.body !== after.body) changes.push(`${label}: texto modificado`);
  if (before.action !== after.action) changes.push(`${label}: acción cambiada`);
  if ((before.listButtonLabel ?? '') !== (after.listButtonLabel ?? '')) changes.push(`${label}: botón de la lista modificado`);
  if (JSON.stringify(before.options) !== JSON.stringify(after.options)) changes.push(`${label}: opciones modificadas`);
  if (before.condition?.type !== after.condition?.type) changes.push(`${label}: condición modificada`);
  if (JSON.stringify(before.block?.copy ?? {}) !== JSON.stringify(after.block?.copy ?? {})) changes.push(`${label}: textos del bloque modificados`);
  return changes;
}

function describeCatalogChanges(a: BotDefinition, b: BotDefinition): string[] {
  const changes: string[] = [];
  for (const scope of ['category', 'plan'] as CatalogScope[]) {
    const before: Record<string, Partial<Record<CatalogField, string>>> = (scope === 'category' ? a.catalogMessages?.categories : a.catalogMessages?.plans) ?? {};
    const after: Record<string, Partial<Record<CatalogField, string>>> = (scope === 'category' ? b.catalogMessages?.categories : b.catalogMessages?.plans) ?? {};
    for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
      for (const field of Object.keys(CATALOG_MESSAGE_FIELDS[scope]) as CatalogField[]) {
        if ((before[id]?.[field] ?? '') === (after[id]?.[field] ?? '')) continue;
        const what = !before[id]?.[field] ? 'agregado' : !after[id]?.[field] ? 'quitado' : 'modificado';
        changes.push(`Mensaje «${CATALOG_MESSAGE_FIELDS[scope][field]?.label ?? field}» de ${scope === 'category' ? 'la plataforma' : 'el plan'} ${id.slice(0, 8)} ${what}`);
      }
    }
  }
  return changes;
}

/** Lista corta y legible de diferencias entre dos definiciones. Vacia si son equivalentes. */
export function diffDefinitions(a: BotDefinition, b: BotDefinition): string[] {
  const changes: string[] = [];
  if (a.entryNodeId !== b.entryNodeId) changes.push(`Nodo de entrada cambiado de «${a.entryNodeId}» a «${b.entryNodeId}»`);
  const before = new Map(a.nodes.map((node) => [node.id, node]));
  const after = new Map(b.nodes.map((node) => [node.id, node]));
  for (const node of b.nodes) if (!before.has(node.id)) changes.push(`Nodo «${node.name}» agregado`);
  for (const node of a.nodes) if (!after.has(node.id)) changes.push(`Nodo «${node.name}» eliminado`);
  for (const node of b.nodes) {
    const previous = before.get(node.id);
    if (previous) changes.push(...describeNodeChanges(previous, node));
  }
  for (const key of MESSAGE_KEYS) {
    if (a.messages[key] !== b.messages[key]) changes.push(`Mensaje «${MESSAGE_CATALOG[key].label}» modificado`);
  }
  for (const key of PARAM_KEYS) {
    if (a.params[key] !== b.params[key]) {
      changes.push(`${PARAM_CATALOG[key].label}: de ${a.params[key]} a ${b.params[key]} ${PARAM_CATALOG[key].unit}`);
    }
  }
  changes.push(...describeCatalogChanges(a, b));
  const added = b.keywords.filter((word) => !a.keywords.includes(word));
  const removed = a.keywords.filter((word) => !b.keywords.includes(word));
  if (added.length > 0) changes.push(`Palabras clave agregadas: ${added.join(', ')}`);
  if (removed.length > 0) changes.push(`Palabras clave quitadas: ${removed.join(', ')}`);
  return changes;
}
