import { conditionOption, nodeVariablesIn, renderNodeBody } from '@/modules/bot-config';
import { createLogger } from '@/platform/observability/logger';
import type { BotService } from '@/modules/messaging/bot-store';
import type { BotNode } from '@/types/bot';
import { trackEvent, type BotRun } from './bot-reply';

const log = createLogger('WhatsAppBotNodes');
const MAX_CONDITION_HOPS = 5;

// Los datos se piden solo si el texto los usa; un fallo de lectura muestra «—» y nunca impide responder.
async function orderValues(run: BotRun): Promise<Record<string, string>> {
  try {
    return await run.deps.orderValues?.() ?? {};
  } catch {
    log.warn('Order values could not be resolved');
    return {};
  }
}

/** El texto del nodo con los datos del pedido de la lista blanca ya resueltos en el servidor. */
export async function nodeWithValues(run: BotRun, node: BotNode): Promise<BotNode> {
  if (node.kind === 'action' || nodeVariablesIn(node.body).length === 0) return node;
  return { ...node, body: renderNodeBody(node.body, await orderValues(run)) };
}

async function conditionAnswer(run: BotRun, node: BotNode, services: BotService[]): Promise<boolean> {
  if (node.condition?.type === 'customer_has_services') return services.length > 0;
  try {
    return await run.deps.catalogHasStock?.() === true;
  } catch {
    log.warn('Catalog stock could not be checked');
    return false;
  }
}

/**
 * Sigue las condiciones del recorrido hasta un nodo que si se muestra. El servidor elige la salida con datos que ya
 * existen; una condicion sin destino valido, o demasiadas seguidas, devuelve null y el cliente no recibe nada nuevo.
 */
export async function followConditions(run: BotRun, start: BotNode, services: BotService[]): Promise<BotNode | null> {
  let node = start;
  for (let hop = 0; node.condition; hop += 1) {
    const answer = await conditionAnswer(run, node, services);
    const option = hop < MAX_CONDITION_HOPS ? conditionOption(node, answer) : undefined;
    const target = option ? run.deps.definition.nodes.find((candidate) => candidate.id === option.next) : undefined;
    if (!option || !target) return null;
    await trackEvent(run, 'option_selected', { nodeId: node.id, optionId: option.id, detail: { condicion: node.condition.type, respuesta: answer, destino: target.id } });
    node = target;
  }
  return node;
}
