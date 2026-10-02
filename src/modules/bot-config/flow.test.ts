import { describe, expect, it } from 'vitest';
import type { BotDefinition, BotNode } from '@/types/bot';
import { defaultDefinition } from './defaults';
import { buildFlowGraph, flowLevels, reachableNodeIds } from './graph';
import { startSimulation, stepSimulation } from './simulate';
import { VARIABLE_CATALOG } from './catalog';
import { updateNode } from './edit';

const text = (id: string, extra: Partial<BotNode> = {}): BotNode => ({ id, name: id, kind: 'text', body: 'x', options: [], ...extra });
const to = (next: string, id = next) => ({ id, title: id, next });

describe('grafo del flujo', () => {
  it('reparte por niveles el flujo por defecto', () => {
    const graph = buildFlowGraph(defaultDefinition());
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    expect(flowLevels(defaultDefinition())).toEqual([['menu'], ['netflix', 'soporte'], ['login', 'viaje']]);
    expect(byId.get('menu')?.y).toBeLessThan(byId.get('netflix')?.y ?? 0);
    expect(byId.get('netflix')?.y).toBe(byId.get('soporte')?.y);
    expect(byId.get('login')?.y).toBeGreaterThan(byId.get('netflix')?.y ?? 0);
    expect(graph.edges).toHaveLength(4);
    expect(graph.edges[0]).toEqual({ from: 'menu', to: 'netflix', label: 'Código de Netflix' });
    expect(graph.nodes.every((n) => n.reachable)).toBe(true);
    for (const n of graph.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x + n.width).toBeLessThanOrEqual(graph.width);
      expect(n.y + n.height).toBeLessThanOrEqual(graph.height);
    }
  });
  it('es determinista y no muta la entrada', () => {
    const def = defaultDefinition();
    const copy = JSON.stringify(def);
    expect(buildFlowGraph(def)).toEqual(buildFlowGraph(def));
    expect(JSON.stringify(def)).toBe(copy);
  });
  it('marca inalcanzables y los coloca al final, en filas', () => {
    const orphans = Array.from({ length: 7 }, (_, i) => text(`o${i}`));
    const def: BotDefinition = { ...defaultDefinition(), nodes: [...defaultDefinition().nodes, ...orphans, text('o0')] };
    const graph = buildFlowGraph(def);
    expect(graph.nodes.filter((n) => !n.reachable)).toHaveLength(7);
    expect(new Set(graph.nodes.map((n) => n.id)).size).toBe(graph.nodes.length);
    const maxReachableY = Math.max(...graph.nodes.filter((n) => n.reachable).map((n) => n.y));
    expect(graph.nodes.filter((n) => !n.reachable).every((n) => n.y > maxReachableY)).toBe(true);
    expect(reachableNodeIds(def).has('o0')).toBe(false);
  });
  it('tolera ciclos, autoapuntados y destinos inexistentes', () => {
    const def: BotDefinition = {
      ...defaultDefinition(), entryNodeId: 'a',
      nodes: [
        { id: 'a', name: 'A', kind: 'buttons', body: 'x', options: [to('b'), to('a', 'self'), to('fantasma')] },
        { id: 'b', name: 'B', kind: 'buttons', body: 'x', options: [to('a')] },
      ],
    };
    const graph = buildFlowGraph(def);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges.map((e) => `${e.from}>${e.to}`)).toEqual(['a>b', 'a>a', 'b>a']);
  });
  it('definicion vacia o sin entrada valida', () => {
    expect(buildFlowGraph({ ...defaultDefinition(), nodes: [] })).toEqual({ nodes: [], edges: [], width: 0, height: 0 });
    const noEntry = buildFlowGraph({ ...defaultDefinition(), entryNodeId: 'zzz' });
    expect(noEntry.nodes.every((n) => !n.reachable)).toBe(true);
    expect(noEntry.nodes).toHaveLength(5);
  });
});

describe('simulador', () => {
  const def = defaultDefinition();
  it('empieza en el menu con botones', () => {
    const state = startSimulation(def);
    expect(state.finished).toBe(false);
    expect(state.currentNodeId).toBe('menu');
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0].buttons?.map((b) => b.title)).toEqual(['Código de Netflix', 'Hablar con soporte']);
  });
  it('recorre menu -> netflix -> inicio de sesion con datos de ejemplo', () => {
    let state = startSimulation(def);
    state = stepSimulation(def, state, 'codigo');
    expect(state.turns.at(-2)).toEqual({ from: 'customer', text: 'Código de Netflix' });
    expect(state.currentNodeId).toBe('netflix');
    state = stepSimulation(def, state, 'login');
    const last = state.turns.at(-1);
    expect(state.finished).toBe(true);
    expect(last?.text).toContain(VARIABLE_CATALOG.codigo.example);
    expect(last?.text).toContain('5 minutos');
    expect(last?.text).not.toContain('{{');
  });
  it('viaje usa perfil de ejemplo y ventana de viaje; soporte usa handoff_ack', () => {
    const viaje = stepSimulation(def, stepSimulation(def, startSimulation(def), 'codigo'), 'viaje');
    expect(viaje.turns.at(-1)?.text).toContain(VARIABLE_CATALOG.perfil.example);
    expect(viaje.turns.at(-1)?.text).toContain('15 minutos');
    const soporte = stepSimulation(def, startSimulation(def), 'soporte');
    expect(soporte.turns.at(-1)?.text).toBe(def.messages.handoff_ack);
    expect(soporte.finished).toBe(true);
  });
  it('no avanza cuando ya termino y no muta el estado previo', () => {
    const done = stepSimulation(def, startSimulation(def), 'soporte');
    expect(stepSimulation(def, done, 'codigo')).toBe(done);
    const start = startSimulation(def);
    const snapshot = JSON.stringify(start);
    stepSimulation(def, start, 'codigo');
    expect(JSON.stringify(start)).toBe(snapshot);
    expect(stepSimulation(def, { turns: [], currentNodeId: null, finished: false }, 'x').turns).toEqual([]);
  });
  it('una opcion que ya no existe avisa y reofrece el menu', () => {
    const state = stepSimulation(def, startSimulation(def), 'borrada');
    expect(state.turns.at(-2)?.text).toBe(def.messages.option_unavailable);
    expect(state.turns.at(-1)?.buttons).toBeDefined();
    expect(state.currentNodeId).toBe('menu');
    expect(state.finished).toBe(false);
  });
  it('un nodo de lista muestra filas', () => {
    const list = updateNode(def, 'menu', { kind: 'list', listButtonLabel: 'Ver' });
    const turn = startSimulation(list).turns[0];
    expect(turn.list?.buttonLabel).toBe('Ver');
    expect(turn.list?.rows).toHaveLength(2);
  });
  it('nodo de texto termina el recorrido', () => {
    const custom: BotDefinition = {
      ...def,
      nodes: [{ ...def.nodes[0], options: [to('info')] }, text('info', { body: 'Horario: 8 a 5' })],
    };
    const state = stepSimulation(custom, startSimulation(custom), 'info');
    expect(state.turns.at(-1)).toEqual({ from: 'bot', text: 'Horario: 8 a 5' });
    expect(state.finished).toBe(true);
  });
  it('opciones invalidas y acciones sin accion no rompen: turno de aviso', () => {
    const empty = updateNode(def, 'menu', { options: [] });
    const first = startSimulation(empty);
    expect(first.turns[0].text).toContain('Aviso del simulador');
    expect(first.finished).toBe(true);
    const noAction = updateNode(def, 'soporte', { action: undefined });
    const state = stepSimulation(noAction, startSimulation(noAction), 'soporte');
    expect(state.turns.at(-1)?.text).toContain('acción válida');
    const dangling: BotDefinition = { ...def, nodes: def.nodes.filter((n) => n.id !== 'netflix') };
    const after = stepSimulation(dangling, startSimulation(dangling), 'codigo');
    expect(after.turns.at(-2)?.text).toBe(def.messages.option_unavailable);
    expect(after.currentNodeId).toBe('menu');
  });
  it('sin nodo de entrada avisa y termina', () => {
    const state = startSimulation({ ...def, entryNodeId: 'zzz' });
    expect(state).toMatchObject({ currentNodeId: null, finished: true });
    expect(state.turns[0].text).toContain('zzz');
  });
  it('un ciclo entre nodos con opciones no cuelga el simulador', () => {
    const loop: BotDefinition = {
      ...def, entryNodeId: 'a',
      nodes: [
        { id: 'a', name: 'A', kind: 'buttons', body: 'a', options: [to('b')] },
        { id: 'b', name: 'B', kind: 'buttons', body: 'b', options: [to('a')] },
      ],
    };
    let state = startSimulation(loop);
    for (let i = 0; i < 6; i += 1) state = stepSimulation(loop, state, state.currentNodeId === 'a' ? 'b' : 'a');
    expect(state.finished).toBe(false);
    expect(state.turns.length).toBe(13);
  });
});
