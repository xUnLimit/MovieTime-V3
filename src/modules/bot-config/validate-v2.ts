import type { BotDefinition, BotNode } from '@/types/bot';
import { ACTION_REGISTRY, isActionKey } from './action-registry';
import { nodeEdges } from './node-edges';
import { conditionSpecSchema, inputSpecSchema } from './v2-schema';
import type { Report } from './validate-nodes';
import { isUuid } from '@/platform/utils/safety';

export function validateV2Node(def: BotDefinition, node: BotNode, ids: ReadonlySet<string>, report: Report): void {
  const path = `nodes[${node.id}]`;
  if (def.schemaVersion === 1 && (node.input || node.condition || node.actionParams ||
    node.kind === 'input' || node.kind === 'condition' || (node.action && isActionKey(node.action) && !ACTION_REGISTRY[node.action].implemented))) {
    report(path, 'Este nodo requiere schemaVersion 2.');
  }
  if (node.kind === 'input') {
    if (!inputSpecSchema.safeParse(node.input).success) report(`${path}.input`, 'Entrada inválida o variable sensible.');
    const rules = node.input?.rules;
    if (rules && ((rules.minLength ?? 0) > (rules.maxLength ?? 512) || (rules.min ?? -Infinity) > (rules.max ?? Infinity))) {
      report(`${path}.input.rules`, 'Los límites están invertidos.');
    }
    if (node.input && ((node.input.tipo !== 'text' && (rules?.pattern || rules?.minLength !== undefined || rules?.maxLength !== undefined)) ||
      (node.input.tipo !== 'number' && (rules?.min !== undefined || rules?.max !== undefined)))) report(`${path}.input.rules`, 'Reglas incompatibles con el tipo de entrada.');
  }
  if (node.kind === 'condition' && !conditionSpecSchema.safeParse(node.condition).success) report(`${path}.condition`, 'Condición inválida.');
  if ((node.kind !== 'input' && node.input) || (node.kind !== 'condition' && node.condition)) report(path, 'Configuración incompatible con el tipo de nodo.');
  if (node.kind === 'input' || node.kind === 'condition') {
    for (const edge of nodeEdges(node)) if (!ids.has(edge.next)) report(`${path}.next`, 'El destino no existe.');
  }
  if (node.kind !== 'action' || !node.action || !isActionKey(node.action)) return;
  const spec = ACTION_REGISTRY[node.action];
  if (!spec.implemented) report(`${path}.action`, 'Acción no disponible todavía; el runtime falla cerrado.', 'warning');
  const params = node.actionParams ?? {};
  for (const required of spec.requiredParams) if (!params[required]?.trim()) report(`${path}.actionParams.${required}`, 'Parámetro obligatorio.');
  for (const [key, value] of Object.entries(params)) {
    if (!spec.requiredParams.includes(key)) report(`${path}.actionParams.${key}`, 'Parámetro no permitido.');
    const variable = /^\{\{([a-z][a-z0-9_]{0,31})\}\}$/.exec(value)?.[1];
    if (variable && !spec.allowedVariables.includes(variable)) report(`${path}.actionParams.${key}`, 'Variable no permitida.');
    if (value.includes('{{') && !variable) report(`${path}.actionParams.${key}`, 'Referencia inválida.');
    if (!variable && !isUuid(value)) report(`${path}.actionParams.${key}`, 'El identificador debe ser UUID.');
  }
}
