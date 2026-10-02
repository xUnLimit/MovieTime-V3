import type { BotDefinition, BotNode } from '@/types/bot';
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
  const added = b.keywords.filter((word) => !a.keywords.includes(word));
  const removed = a.keywords.filter((word) => !b.keywords.includes(word));
  if (added.length > 0) changes.push(`Palabras clave agregadas: ${added.join(', ')}`);
  if (removed.length > 0) changes.push(`Palabras clave quitadas: ${removed.join(', ')}`);
  return changes;
}
