import type { BotActionKey, BotDefinition, BotNode } from '@/types/bot';
import { COPY_CATALOG, blockCopyProblem, blockOfCopyKey, type CopyKey } from '@/modules/commerce-copy';
import { MAX_CONTINUE_HOPS, VARIABLE_CATALOG } from './catalog';
import { matchTextAnswer } from './answers';
import { CONDITION_CATALOG, MAX_CONDITION_HOPS, conditionOption, exampleNodeValues, renderNodeBody, type ConditionFacts } from './extensions';
import { buildNodeMessage, optionReplyId, resolveOption } from './payload';
import { blockCopyOverrides, blockOptionSpec } from './purchase-blocks';
import { renderTemplate } from './render';

type SimulationTurn = {
  from: 'bot' | 'customer'; text: string;
  buttons?: { id: string; title: string }[];
  list?: { buttonLabel: string; rows: { id: string; title: string; description?: string }[] };
};
/** Datos de ejemplo editables: que respondera cada condicion y que valor tiene cada dato del pedido. Nada sale del navegador. */
export type SimulationSample = { facts: ConditionFacts; values: Record<string, string> };
/** `copy`: textos de compras guardados en el servidor (los del lienzo mandan sobre ellos, como en el bot real). */
export type SimulationState = {
  turns: SimulationTurn[]; currentNodeId: string | null; finished: boolean; sample?: SimulationSample;
  /** Un texto que espera la respuesta escrita del cliente: la simulación sigue con `answerSimulation`. */
  awaitingNodeId?: string;
  copy?: Readonly<Record<string, string>>;
};
type Context = { def: BotDefinition; sample: SimulationSample; copy?: Readonly<Record<string, string>> };

/**
 * Paso del flujo de compras que responde un nodo del recorrido: el catalogo y los botones de comprar, renovar y
 * "mis servicios" los contesta el servidor con datos reales; los demas bloques muestran el resumen o el pedido.
 * Lo usan el simulador y el bot real, para que ambos decidan igual.
 */
export type PurchaseStep = 'buy' | 'renew' | 'services' | 'summary';
const ACTION_STEPS: Partial<Record<BotActionKey, PurchaseStep>> = { purchase: 'buy', renewal: 'renew', my_services: 'services' };
export function purchaseStepOf(node: BotNode): PurchaseStep | null {
  if (node.block) return node.block.type === 'catalogo' ? 'buy' : 'summary';
  return node.kind === 'action' && node.action ? ACTION_STEPS[node.action] ?? null : null;
}

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

const withPrefix = (prefix: string | undefined, text: string) => (prefix ? `${prefix}\n\n${text}` : text);

/** Texto de compras que veria el cliente: el del lienzo, si no el guardado en el servidor, si no el original. */
function copyText({ def, copy }: Context, key: CopyKey): string {
  for (const text of [blockCopyOverrides(def)[key], copy?.[key]]) {
    if (typeof text === 'string' && blockCopyProblem(blockOfCopyKey(key), key, text) === null) return text.trim();
  }
  return COPY_CATALOG[key].defaultText;
}

function actionTurns(def: BotDefinition, action: BotActionKey | undefined, prefix?: string): SimulationTurn[] {
  if (action === 'netflix_login_code') {
    return [{ from: 'bot', text: renderTemplate(def.messages.login_code_sent, sampleValues(def.params.loginWindowMinutes)) }];
  }
  if (action === 'netflix_travel_code') {
    return [{ from: 'bot', text: renderTemplate(def.messages.travel_code_sent, sampleValues(def.params.travelWindowMinutes)) }];
  }
  if (action === 'handoff') return [{ from: 'bot', text: withPrefix(prefix, def.messages.handoff_ack) }];
  if (action === 'service_access') {
    return [warning('aquí el cliente recibe los datos de su servicio (correo, contraseña, perfil…) con la plantilla «Notificación de Suscripción»; el simulador no los muestra. Con varios servicios, primero elige de cuál.')];
  }
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

/**
 * Como en el bot real, en un mismo mensaje el recorrido pasa el turno al flujo de compras una sola vez (`delegated`) y
 * este lo devuelve una sola vez (`handedBack`). `prefix`: aviso que viaja con el nodo en un solo mensaje.
 */
type Entering = { hops: number; lenient: boolean; prefix?: string; delegated?: boolean; handedBack?: boolean };
type Preview = { turns: SimulationTurn[]; finished: boolean };

function state(ctx: Context, turns: SimulationTurn[], currentNodeId: string | null, finished: boolean, awaitingNodeId?: string): SimulationState {
  return { turns, currentNodeId, finished, sample: ctx.sample, ...(ctx.copy ? { copy: ctx.copy } : {}), ...(awaitingNodeId ? { awaitingNodeId } : {}) };
}

/** Botones de un bloque con los titulos que usa el flujo de compras; permiten seguir la cadena en el simulador. */
function blockButtons(ctx: Context, node: BotNode): { id: string; title: string }[] {
  return node.options.map((option) => {
    const spec = blockOptionSpec(node, option.id);
    return { id: optionReplyId(node.id, option.id), title: spec ? copyText(ctx, spec.copyKey) : option.title };
  });
}

function blockPreview(ctx: Context, node: BotNode, prefix?: string): Preview {
  const total = ctx.sample.values.pedido_total || '$10.00';
  const texts: Record<string, string> = {
    resumen: `${copyText(ctx, 'summaryTitle')}\n1. Servicio de ejemplo: ${total}\nTotal: ${total}\n\n${copyText(ctx, 'confirmNote')}`,
    reserva: renderTemplate(copyText(ctx, 'reservation'), {
      servicio: 'Servicio de ejemplo', monto: total, pedido: '8faf2421', plazo: ctx.sample.values.pedido_vence || 'que venza la reserva',
    }),
    pago: renderTemplate(copyText(ctx, 'paymentInstructions'), { instrucciones: 'Datos de pago configurados en el servidor.' }),
  };
  const buttons = blockButtons(ctx, node);
  if (node.block?.type === 'catalogo') {
    const rows = buttons.map((button) => ({ ...button, description: 'Tu carrito' }));
    return { finished: rows.length === 0, turns: [
      warning('aquí el cliente ve las plataformas con cupo y sus planes del catálogo real; el simulador no crea pedidos ni cobra.'),
      { from: 'bot', text: withPrefix(prefix, copyText(ctx, 'platformsPrompt')), list: { buttonLabel: copyText(ctx, 'listButtonPlatforms'), rows } },
    ] };
  }
  const type = node.block?.type ?? 'resumen';
  return { finished: buttons.length === 0, turns: [
    warning(`si el cliente llega aquí sin una selección, recibe «${copyText(ctx, 'emptyCart')}» y vuelve al recorrido.`),
    { from: 'bot', text: withPrefix(prefix, texts[type]), buttons },
  ] };
}

/**
 * Lo que el flujo de compras responde de verdad en un nodo de compra; nunca el texto interno del bloque. Si ya respondio
 * en este mismo mensaje y devolvio el turno al recorrido, el cliente solo recibe su aviso.
 */
function purchaseTurns(ctx: Context, node: BotNode, step: PurchaseStep, at: Entering): SimulationState {
  const abroad = warning(`los números que no son de Panamá (+507) reciben «${ctx.def.messages.option_unavailable}» en su lugar.`);
  const hasServices = ctx.sample.facts.customer_has_services;
  const done = (turns: SimulationTurn[]) => state(ctx, turns, node.id, true);
  const bubble = (text: string): SimulationTurn => ({ from: 'bot', text: withPrefix(at.prefix, text) });
  if (at.delegated) return done([{ from: 'bot', text: at.prefix ?? copyText(ctx, 'noOptions') }]);
  if (step === 'buy' && !node.block) {
    return done([warning(`aquí el cliente ve las plataformas con cupo del catálogo real. Si las compras por WhatsApp están apagadas en Configuración, recibe «${copyText(ctx, 'purchasesPaused')}».`),
      bubble(copyText(ctx, 'platformsPrompt')), abroad]);
  }
  if (step === 'renew') {
    return done(hasServices ? [warning('aquí el cliente elige cuáles de sus propios servicios renovar.'), bubble(copyText(ctx, 'renewPrompt')), abroad]
      : [bubble(copyText(ctx, 'noOptions')), abroad]);
  }
  if (step === 'services') {
    if (hasServices) {
      return done([bubble(`${copyText(ctx, 'servicesTitle')}\n• Servicio de ejemplo: vence el 31 de octubre de 2026\n\n${copyText(ctx, 'servicesHint')}`), abroad]);
    }
    // Sin servicios el flujo de compras devuelve el turno al recorrido: su aviso y el inicio en un solo mensaje
    // (si ya lo habia devuelto en este mensaje, solo su aviso).
    const notice = withPrefix(at.prefix, copyText(ctx, 'noServices'));
    if (at.handedBack) return done([{ from: 'bot', text: notice }]);
    return enterEntry(ctx, [], { hops: 0, lenient: true, prefix: notice, delegated: true, handedBack: true });
  }
  const preview = blockPreview(ctx, node, at.prefix);
  return state(ctx, [...preview.turns, abroad], node.id, preview.finished);
}

/** El texto tal como lo recibe el cliente (recortado como el bot real): solo texto, sin botones. */
function plainText(node: BotNode, body: string): string {
  const message = buildNodeMessage({ ...node, kind: 'text', options: [], body });
  return message.kind === 'text' ? message.text : body;
}

/**
 * Un texto que continúa o espera. `continue` muestra mensajes juntos o separados, como el bot real.
 * `wait`: se envía y la simulación espera lo que escriba el cliente.
 */
function enterTextAfter(ctx: Context, node: BotNode, after: NonNullable<BotNode['after']>, turns: SimulationTurn[], at: Entering): SimulationState {
  const body = withPrefix(at.prefix, renderNodeBody(node.body, ctx.sample.values));
  if (after.mode === 'wait') return state(ctx, [...turns, { from: 'bot', text: plainText(node, body) }], node.id, false, node.id);
  const next = ctx.def.nodes.find((candidate) => candidate.id === node.options[0]?.next);
  if (!next || at.hops >= MAX_CONTINUE_HOPS) {
    return state(ctx, [...turns, { from: 'bot', text: plainText(node, body) }, warning('este texto no tiene un paso siguiente válido y el cliente no podría continuar.')], node.id, true);
  }
  return enterNode(ctx, next, after.delivery === 'separate' ? [...turns, { from: 'bot', text: plainText(node, body) }] : turns,
    { ...at, hops: at.hops + 1, prefix: after.delivery === 'separate' ? undefined : body });
}

function enterNode(ctx: Context, node: BotNode, turns: SimulationTurn[], at: Entering): SimulationState {
  if (node.condition) {
    const answer = ctx.sample.facts[node.condition.type];
    const label = CONDITION_CATALOG[node.condition.type];
    const note = warning(`condición «${label.label}»: ${answer ? label.yes : label.no}.`);
    const target = at.hops < MAX_CONDITION_HOPS ? conditionTarget(ctx.def, node, answer, at.lenient) : undefined;
    if (!target) return state(ctx, [...turns, note, warning('la condición no tiene un destino válido y el cliente no podría continuar.')], node.id, true);
    return enterNode(ctx, target, [...turns, note], { ...at, hops: at.hops + 1 });
  }
  const step = purchaseStepOf(node);
  if (step) {
    const preview = purchaseTurns(ctx, node, step, at);
    return { ...preview, turns: [...turns, ...preview.turns] };
  }
  if (node.kind === 'action') return state(ctx, [...turns, ...actionTurns(ctx.def, node.action, at.prefix)], node.id, true);
  if (node.kind === 'text' && node.after) return enterTextAfter(ctx, node, node.after, turns, at);
  const message = buildNodeMessage({ ...node, body: withPrefix(at.prefix, renderNodeBody(node.body, ctx.sample.values)) });
  if (message.kind === 'text') {
    const invalid = node.kind !== 'text';
    const turn = invalid ? warning(`el nodo «${node.name}» no tiene opciones y el cliente no podría continuar.`) : { from: 'bot' as const, text: message.text };
    return state(ctx, [...turns, turn], node.id, true);
  }
  const turn: SimulationTurn = message.kind === 'buttons'
    ? { from: 'bot', text: message.body, buttons: message.buttons }
    : { from: 'bot', text: message.body, list: { buttonLabel: message.buttonLabel, rows: message.rows } };
  return state(ctx, [...turns, turn], node.id, false);
}

function enterEntry(ctx: Context, turns: SimulationTurn[], at: Entering = { hops: 0, lenient: true }): SimulationState {
  const entry = ctx.def.nodes.find((node) => node.id === ctx.def.entryNodeId);
  if (!entry) return state(ctx, [...turns, warning(`el nodo de entrada «${ctx.def.entryNodeId}» no existe.`)], null, true);
  return enterNode(ctx, entry, turns, { ...at, lenient: true });
}

export function startSimulation(def: BotDefinition, sample: SimulationSample = defaultSample(), copy?: Readonly<Record<string, string>>): SimulationState {
  return enterEntry({ def, sample, copy }, []);
}

/**
 * Un toque del cliente. Una opcion que ya no existe responde `option_unavailable` y el inicio en un solo mensaje, y
 * "Cancelar" de un bloque de compra lleva su aviso al nodo conectado, como el bot real.
 */
export function stepSimulation(def: BotDefinition, current: SimulationState, optionId: string): SimulationState {
  if (current.finished || current.currentNodeId === null) return current;
  const ctx: Context = { def, sample: current.sample ?? defaultSample(), copy: current.copy };
  const resolved = resolveOption(def, current.currentNodeId, optionId);
  if (!resolved) return enterEntry(ctx, current.turns, { hops: 0, lenient: true, prefix: def.messages.option_unavailable });
  const { node, option, target } = resolved;
  const cancelled = node.block && option.id === 'cancel' ? copyText(ctx, node.block.type === 'resumen' ? 'cancelled' : 'orderCancelled') : undefined;
  const turns = [...current.turns, { from: 'customer' as const, text: option.title }];
  return enterNode(ctx, target, turns, {
    hops: 0, lenient: cancelled !== undefined && target.id === def.entryNodeId, prefix: cancelled, handedBack: cancelled !== undefined,
  });
}

/**
 * Lo que el cliente escribe cuando un texto espera su respuesta: sigue por la salida que coincide o, si ninguna coincide y no hay
 * «cualquier otra respuesta», el bot no contesta y el chat queda para una persona.
 */
export function answerSimulation(def: BotDefinition, current: SimulationState, written: string): SimulationState {
  const text = written.trim();
  const node = def.nodes.find((candidate) => candidate.id === current.awaitingNodeId);
  if (current.finished || !node || text === '') return current;
  const ctx: Context = { def, sample: current.sample ?? defaultSample(), copy: current.copy };
  const turns = [...current.turns, { from: 'customer' as const, text }];
  const option = matchTextAnswer(node, text);
  const target = option ? def.nodes.find((candidate) => candidate.id === option.next) : undefined;
  if (!target) return state(ctx, [...turns, warning('el bot no contesta: ninguna respuesta coincide y no hay «cualquier otra respuesta». El chat queda para una persona.')], node.id, true);
  return enterNode(ctx, target, turns, { hops: 0, lenient: false });
}
