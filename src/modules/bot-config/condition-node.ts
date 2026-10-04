import type { BotConditionType, BotNode, BotOption } from '@/types/bot';
import { CONDITION_CATALOG, CONDITION_OPTION_IDS } from './extensions';

/** Las dos salidas fijas de una condicion; `next` es el destino inicial de ambas. */
export function conditionOptions(type: BotConditionType, next: string): BotOption[] {
  const spec = CONDITION_CATALOG[type];
  return [
    { id: CONDITION_OPTION_IDS.yes, title: spec.yes, next },
    { id: CONDITION_OPTION_IDS.no, title: spec.no, next },
  ];
}

/**
 * Cambios permitidos en un nodo de condicion: nombre, texto y tipo de condicion. Al cambiar el tipo, los titulos de
 * las salidas siguen al tipo solo si no fueron editados.
 */
export function patchConditionNode(node: BotNode, patch: Partial<Omit<BotNode, 'id'>>): BotNode {
  const condition = node.condition;
  if (!condition) return node;
  const next: BotNode = {
    ...node,
    ...(patch.name === undefined ? {} : { name: patch.name }),
    ...(patch.body === undefined ? {} : { body: patch.body }),
  };
  const type = patch.condition?.type;
  if (type === undefined || type === condition.type) return next;
  const old = CONDITION_CATALOG[condition.type];
  const fresh = CONDITION_CATALOG[type];
  return {
    ...next, condition: { type },
    options: next.options.map((option) => {
      if (option.id === CONDITION_OPTION_IDS.yes && option.title === old.yes) return { ...option, title: fresh.yes };
      if (option.id === CONDITION_OPTION_IDS.no && option.title === old.no) return { ...option, title: fresh.no };
      return option;
    }),
  };
}
