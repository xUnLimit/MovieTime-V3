import type { BotActionKey, BotDefinition, BotNode } from '@/types/bot';
import { VARIABLE_CATALOG } from './catalog';
import { buildNodeMessage, resolveOption } from './payload';
import { renderTemplate } from './render';

type SimulationTurn = {
  from: 'bot' | 'customer'; text: string;
  buttons?: { id: string; title: string }[];
  list?: { buttonLabel: string; rows: { id: string; title: string; description?: string }[] };
};
export type SimulationState = { turns: SimulationTurn[]; currentNodeId: string | null; finished: boolean };

function sampleValues(minutes: number): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, spec] of Object.entries(VARIABLE_CATALOG)) values[name] = spec.example;
  values.minutos = String(minutes);
  return values;
}

function warning(text: string): SimulationTurn {
  return { from: 'bot', text: `Aviso del simulador: ${text}` };
}

function actionTurns(def: BotDefinition, action: BotActionKey | undefined): SimulationTurn[] {
  if (action === 'netflix_login_code') {
    return [{ from: 'bot', text: renderTemplate(def.messages.login_code_sent, sampleValues(def.params.loginWindowMinutes)) }];
  }
  if (action === 'netflix_travel_code') {
    return [{ from: 'bot', text: renderTemplate(def.messages.travel_code_sent, sampleValues(def.params.travelWindowMinutes)) }];
  }
  if (action === 'handoff') return [{ from: 'bot', text: def.messages.handoff_ack }];
  return [warning('este nodo de acción no tiene una acción válida.')];
}

function enterNode(def: BotDefinition, node: BotNode, turns: SimulationTurn[]): SimulationState {
  if (node.kind === 'action') {
    return { turns: [...turns, ...actionTurns(def, node.action)], currentNodeId: node.id, finished: true };
  }
  const message = buildNodeMessage(node);
  if (message.kind === 'text') {
    const invalid = node.kind !== 'text';
    const turn = invalid ? warning(`el nodo «${node.name}» no tiene opciones y el cliente no podría continuar.`) : { from: 'bot' as const, text: message.text };
    return { turns: [...turns, turn], currentNodeId: node.id, finished: true };
  }
  const turn: SimulationTurn = message.kind === 'buttons'
    ? { from: 'bot', text: message.body, buttons: message.buttons }
    : { from: 'bot', text: message.body, list: { buttonLabel: message.buttonLabel, rows: message.rows } };
  return { turns: [...turns, turn], currentNodeId: node.id, finished: false };
}

function enterEntry(def: BotDefinition, turns: SimulationTurn[]): SimulationState {
  const entry = def.nodes.find((node) => node.id === def.entryNodeId);
  if (!entry) {
    return { turns: [...turns, warning(`el nodo de entrada «${def.entryNodeId}» no existe.`)], currentNodeId: null, finished: true };
  }
  return enterNode(def, entry, turns);
}

export function startSimulation(def: BotDefinition): SimulationState {
  return enterEntry(def, []);
}

/** Un toque del cliente. Una opcion que ya no existe responde `option_unavailable` y reofrece el menu. */
export function stepSimulation(def: BotDefinition, state: SimulationState, optionId: string): SimulationState {
  if (state.finished || state.currentNodeId === null) return state;
  const resolved = resolveOption(def, state.currentNodeId, optionId);
  if (!resolved) {
    return enterEntry(def, [...state.turns, { from: 'bot', text: def.messages.option_unavailable }]);
  }
  return enterNode(def, resolved.target, [...state.turns, { from: 'customer', text: resolved.option.title }]);
}
