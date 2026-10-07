import { describe, expect, it } from 'vitest';
import type { BotActionKey, BotDefinition } from '@/types/bot';
import { defaultDefinition } from './defaults';
import { addOption, connectOption, updateNode } from './edit';
import { addPurchaseFlow, setBlockCopy } from './purchase-blocks';
import { defaultSample, purchaseStepOf, startSimulation, stepSimulation } from './simulate';

// El nodo "soporte" del recorrido por defecto pasa a ser la accion de compras indicada.
const withAction = (action: BotActionKey): BotDefinition => updateNode(defaultDefinition(), 'soporte', { action });
function withBlocks(): BotDefinition {
  const flow = addOption(addPurchaseFlow(defaultDefinition()), 'menu');
  return connectOption(flow, 'menu', flow.nodes.find((node) => node.id === 'menu')!.options.at(-1)!.id, 'compra_catalogo');
}
const texts = (state: ReturnType<typeof startSimulation>) => state.turns.map((turn) => turn.text);
// Lo ultimo que dice el bot sin contar los avisos del simulador.
const shown = (state: ReturnType<typeof startSimulation>) => state.turns.filter((turn) => !turn.text.startsWith('Aviso del simulador')).at(-1)!;
const optionId = (def: BotDefinition, nodeId: string, next: string) => def.nodes.find((node) => node.id === nodeId)!.options.find((option) => option.next === next)!.id;

describe('simulador: nodos de compra', () => {
  it('reconoce el paso de compras de cada nodo', () => {
    const def = withBlocks();
    const step = (id: string) => purchaseStepOf(def.nodes.find((node) => node.id === id)!);
    expect(step('compra_catalogo')).toBe('buy');
    expect(step('compra_resumen')).toBe('summary');
    expect(step('menu')).toBeNull();
    expect(purchaseStepOf(withAction('purchase').nodes.find((node) => node.id === 'soporte')!)).toBe('buy');
    expect(purchaseStepOf(withAction('renewal').nodes.find((node) => node.id === 'soporte')!)).toBe('renew');
    expect(purchaseStepOf(withAction('my_services').nodes.find((node) => node.id === 'soporte')!)).toBe('services');
    expect(purchaseStepOf(withAction('handoff').nodes.find((node) => node.id === 'soporte')!)).toBeNull();
  });

  it('una accion de comprar muestra lo que recibe el cliente y avisa a los numeros que no son de Panama', () => {
    const def = withAction('purchase');
    const state = stepSimulation(def, startSimulation(def), 'soporte');
    expect(texts(state).join('\n')).toContain('plataformas con cupo');
    expect(texts(state).join('\n')).toContain('¿Qué plataforma te interesa?');
    expect(texts(state).join('\n')).toContain(`«${def.messages.option_unavailable}»`);
    expect(state.finished).toBe(true);
  });

  it('renovar depende de si el cliente tiene servicios', () => {
    const def = withAction('renewal');
    expect(texts(stepSimulation(def, startSimulation(def), 'soporte')).join('\n')).toContain('cuáles de sus propios servicios');
    const sample = defaultSample();
    sample.facts.customer_has_services = false;
    const without = stepSimulation(def, startSimulation(def, sample), 'soporte');
    expect(texts(without).join('\n')).toContain('Por ahora no tengo opciones para ti');
    expect(without.finished).toBe(true);
  });

  it('mis servicios lista los del cliente o, sin ninguno, devuelve el recorrido con el aviso en un solo mensaje', () => {
    const def = withAction('my_services');
    const listed = stepSimulation(def, startSimulation(def), 'soporte');
    expect(texts(listed).join('\n')).toContain('Servicio de ejemplo: vence el');
    expect(listed.finished).toBe(true);
    const sample = defaultSample();
    sample.facts.customer_has_services = false;
    const without = stepSimulation(def, startSimulation(def, sample), 'soporte');
    const last = without.turns.at(-1)!;
    expect(last.text).toContain('No encuentro servicios activos con este número.');
    expect(last.text).toContain(def.nodes[0].body);
    expect(last.buttons).toBeDefined();
    expect(without.finished).toBe(false);
    expect(without.currentNodeId).toBe('menu');
  });

  it('si el recorrido ya devolvio el turno y vuelve a caer en una compra, solo dice el aviso', () => {
    let def = withAction('my_services');
    def = { ...def, entryNodeId: 'soporte' };
    const sample = defaultSample();
    sample.facts.customer_has_services = false;
    const state = startSimulation(def, sample);
    expect(state.turns.at(-1)).toEqual({ from: 'bot', text: expect.stringContaining('No encuentro servicios activos') });
    expect(state.turns.at(-1)?.buttons).toBeUndefined();
    expect(state.finished).toBe(true);
  });

  it('un bloque de catalogo nunca muestra su texto interno: muestra la lista de plataformas y sigue la cadena', () => {
    const def = withBlocks();
    const toCatalog = optionId(def, 'menu', 'compra_catalogo');
    const catalog = stepSimulation(def, startSimulation(def), toCatalog);
    expect(texts(catalog).join('\n')).not.toContain('Catálogo de compra. El cliente elige');
    const list = shown(catalog);
    expect(list.text).toBe('¿Qué plataforma te interesa? Elige una de la lista. Cuando termines, toca Revisar carrito.');
    expect(list.list?.rows.map((row) => row.id)).toEqual(['BOT:compra_catalogo:resumen']);
    expect(catalog.currentNodeId).toBe('compra_catalogo');
    expect(catalog.finished).toBe(false);
    const summary = stepSimulation(def, catalog, 'resumen');
    expect(shown(summary).text).toContain('Total: $12.50');
    expect(shown(summary).buttons?.map((button) => button.id)).toEqual(['BOT:compra_resumen:confirm', 'BOT:compra_resumen:cancel']);
    expect(texts(summary).join('\n')).toContain('Tu carrito está vacío todavía');
    const reserved = stepSimulation(def, summary, 'confirm');
    expect(shown(reserved).text).toContain('Servicio de ejemplo');
    const paid = stepSimulation(def, reserved, 'pay');
    expect(shown(paid).text).toContain('Datos de pago configurados en el servidor.');
  });

  it('cancelar en un bloque lleva el aviso al nodo que su salida conecta, en un solo mensaje', () => {
    const def = withBlocks();
    const summary = stepSimulation(def, stepSimulation(def, startSimulation(def), optionId(def, 'menu', 'compra_catalogo')), 'resumen');
    const back = stepSimulation(def, summary, 'cancel');
    const last = back.turns.at(-1)!;
    expect(last.text).toBe(`Listo, cancelé tu selección. ¿Qué necesitas ahora?\n\n${def.nodes[0].body}`);
    expect(last.buttons).toBeDefined();
    expect(back.currentNodeId).toBe('menu');
    // Con un pedido reservado el aviso es el del pedido.
    const reserved = stepSimulation(def, stepSimulation(def, summary, 'confirm'), 'cancel');
    expect(shown(reserved).text).toContain('cancelé tu pedido y liberé la reserva');
  });

  it('los textos del lienzo mandan sobre los guardados en el servidor y estos sobre los originales', () => {
    let def = withBlocks();
    def = setBlockCopy(def, 'compra_catalogo', 'platformsPrompt', 'Elige tu plataforma favorita.');
    const copy = { platformsPrompt: 'Texto del servidor.', btnReview: 'Ver carrito' };
    const state = stepSimulation(def, startSimulation(def, defaultSample(), copy), optionId(def, 'menu', 'compra_catalogo'));
    expect(shown(state).text).toBe('Elige tu plataforma favorita.');
    expect(state.copy).toEqual(copy);
    const saved = stepSimulation(withBlocks(), startSimulation(withBlocks(), defaultSample(), copy), optionId(withBlocks(), 'menu', 'compra_catalogo'));
    expect(shown(saved).text).toBe('Texto del servidor.');
    // Un texto invalido guardado en el servidor no se usa.
    const invalid = stepSimulation(withBlocks(), startSimulation(withBlocks(), defaultSample(), { platformsPrompt: '' }), optionId(withBlocks(), 'menu', 'compra_catalogo'));
    expect(shown(invalid).text).toContain('¿Qué plataforma te interesa?');
  });

  it('una entrada que es un nodo de compra muestra lo que recibe el cliente', () => {
    const def = { ...withAction('purchase'), entryNodeId: 'soporte' };
    const state = startSimulation(def);
    expect(texts(state).join('\n')).toContain('¿Qué plataforma te interesa?');
    expect(state.finished).toBe(true);
  });
});
