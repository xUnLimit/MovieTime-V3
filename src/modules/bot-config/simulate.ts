import type { BotActionKey, BotDefinition, BotNode } from '@/types/bot';
import { VARIABLE_CATALOG } from './catalog';
import { CONDITION_CATALOG, MAX_CONDITION_HOPS, conditionOption, exampleNodeValues, renderNodeBody, type ConditionFacts } from './extensions';
import { buildNodeMessage, resolveOption } from './payload';
import { renderTemplate } from './render';

type SimulationTurn = {
  from: 'bot' | 'customer'; text: string;
  buttons?: { id: string; title: string }[];
  list?: { buttonLabel: string; rows: { id: string; title: string; description?: string }[] };
};
/** Datos de ejemplo editables: que respondera cada condicion y que valor tiene cada dato del pedido. Nada sale del navegador. */
export type SimulationSample = { facts: ConditionFacts; values: Record<string, string> };
export type SimulationState = { turns: SimulationTurn[]; currentNodeId: string | null; finished: boolean; sample?: SimulationSample };

export function defaultSample(): SimulationSample {
  return { facts: { customer_has_services: true, catalog_has_stock: true }, values: exampleNodeValues() };
}

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
  if (action === 'purchase') return [{ from: 'bot', text: 'El catálogo muestra servicios disponibles y agotados. Selecciona servicios, revisa el carrito y confirma para reservar. Los precios y el pago se verifican en el servidor.' }];
  if (action === 'renewal') return [{ from: 'bot', text: 'El cliente selecciona sus servicios, confirma el resumen y recibe instrucciones de pago. El simulador no crea pedidos ni cobra.' }];
  if (action === 'my_services') return [{ from: 'bot', text: 'Se mostrarían únicamente los servicios del número que escribe. No se cargan datos reales en el simulador.' }];
  return [warning('este nodo de acción no tiene una acción válida.')];
}

/** Como el servidor al inicio del recorrido: si la salida que toca no lleva a un nodo existente, usa la otra. */
function conditionTarget(def: BotDefinition, node: BotNode, answer: boolean, lenient: boolean) {
  for (const candidate of lenient ? [answer, !answer] : [answer]) {
    const option = conditionOption(node, candidate);
    const target = option ? def.nodes.find((item) => item.id === option.next) : undefined;
    if (target) return target;
  }
  return undefined;
}

function enterNode(def: BotDefinition, node: BotNode, turns: SimulationTurn[], sample: SimulationSample, hops = 0, lenient = false): SimulationState {
  if (node.condition) {
    const answer = sample.facts[node.condition.type];
    const label = CONDITION_CATALOG[node.condition.type];
    const note = warning(`condición «${label.label}»: ${answer ? label.yes : label.no}.`);
    const target = hops < MAX_CONDITION_HOPS ? conditionTarget(def, node, answer, lenient) : undefined;
    if (!target) return { turns: [...turns, note, warning('la condición no tiene un destino válido y el cliente no podría continuar.')], currentNodeId: node.id, finished: true, sample };
    return enterNode(def, target, [...turns, note], sample, hops + 1, lenient);
  }
  if (node.kind === 'action') {
    return { turns: [...turns, ...actionTurns(def, node.action)], currentNodeId: node.id, finished: true, sample };
  }
  const message = buildNodeMessage({ ...node, body: renderNodeBody(node.body, sample.values) });
  if (message.kind === 'text') {
    const invalid = node.kind !== 'text';
    const turn = invalid ? warning(`el nodo «${node.name}» no tiene opciones y el cliente no podría continuar.`) : { from: 'bot' as const, text: message.text };
    return { turns: [...turns, turn], currentNodeId: node.id, finished: true, sample };
  }
  const turn: SimulationTurn = message.kind === 'buttons'
    ? { from: 'bot', text: message.body, buttons: message.buttons }
    : { from: 'bot', text: message.body, list: { buttonLabel: message.buttonLabel, rows: message.rows } };
  return { turns: [...turns, turn], currentNodeId: node.id, finished: false, sample };
}

function enterEntry(def: BotDefinition, turns: SimulationTurn[], sample: SimulationSample): SimulationState {
  const entry = def.nodes.find((node) => node.id === def.entryNodeId);
  if (!entry) {
    return { turns: [...turns, warning(`el nodo de entrada «${def.entryNodeId}» no existe.`)], currentNodeId: null, finished: true, sample };
  }
  return enterNode(def, entry, turns, sample, 0, true);
}

export function startSimulation(def: BotDefinition, sample: SimulationSample = defaultSample()): SimulationState {
  return enterEntry(def, [], sample);
}

/** Un toque del cliente. Una opcion que ya no existe responde `option_unavailable` y reofrece el menu. */
export function stepSimulation(def: BotDefinition, state: SimulationState, optionId: string): SimulationState {
  if (state.finished || state.currentNodeId === null) return state;
  const sample = state.sample ?? defaultSample();
  const resolved = resolveOption(def, state.currentNodeId, optionId);
  if (!resolved) {
    return enterEntry(def, [...state.turns, { from: 'bot', text: def.messages.option_unavailable }], sample);
  }
  return enterNode(def, resolved.target, [...state.turns, { from: 'customer', text: resolved.option.title }], sample);
}
