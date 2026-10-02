import { describe, expect, it } from 'vitest';
import type { BotDefinition, BotNode } from '@/types/bot';
import type { ConversationState } from '@/platform/validation/conversation-state';
import { defaultDefinition } from './defaults';
import { parseDefinition, upgradeDefinition } from './schema';
import { hasBlockingIssues, validateDefinition } from './validate';
import { advance, matchesSafePattern, type ConversationInput } from './conversation-engine';
import { startSimulation, stepSimulation } from './simulate';
import { buildFlowGraph } from './graph';
import { ACTION_REGISTRY } from './action-registry';

const now = '2026-10-03T07:00:00.000Z';
const uuid = '51111111-1111-4111-8111-111111111111';
const context = { contact: 'cliente' as const, activeCategories: [uuid], pendingOrder: true };
const terminal: BotNode = { id: 'done', name: 'Final', kind: 'text', body: 'Gracias', options: [] };
function flow(nodes: BotNode[]): BotDefinition { return { ...upgradeDefinition(defaultDefinition()), entryNodeId: nodes[0].id, nodes }; }
function inputNode(tipo: 'text' | 'number' | 'image' = 'text'): BotNode {
  return { id: 'ask', name: 'Pregunta', kind: 'input', body: 'Responde', options: [], input: { tipo, variable: 'respuesta', next: 'done', timeoutSeconds: 60, rules: {} } };
}
const state = (nodeId = 'ask'): ConversationState => ({ flowVersion: 7, nodeId, variables: {}, awaiting: null, owner: 'bot' });
const enter: ConversationInput = { now, flowVersion: 7, context, event: { kind: 'enter' } };

describe('definition v2', () => {
  it('exposes only the connected catalog, interest and sale-code capabilities', () => {
    expect(ACTION_REGISTRY.show_catalog.implemented).toBe(true);
    expect(ACTION_REGISTRY.register_interest.implemented).toBe(true);
    expect(ACTION_REGISTRY.send_code.implemented).toBe(true);
    for (const key of ['request_payment', 'verify_payment', 'deliver_credentials', 'renew_services'] as const) {
      expect(ACTION_REGISTRY[key].implemented).toBe(false);
    }
  });
  it('keeps serialized v1 definitions and upgrade is explicit, deep and idempotent', () => {
    const v1 = defaultDefinition();
    expect(parseDefinition(JSON.parse(JSON.stringify(v1)))).toEqual({ success: true, definition: v1 });
    const v2 = upgradeDefinition(v1);
    expect(v1.schemaVersion).toBe(1);
    expect(v2.nodes).not.toBe(v1.nodes);
    expect(v2).toEqual({ ...v1, schemaVersion: 2 });
    expect(upgradeDefinition(v2)).toEqual(v2);
    expect(parseDefinition(v2).success).toBe(true);
    expect(validateDefinition(v2)).toEqual([]);
  });
  it('validates new graph edges, absent fields and secret variables', () => {
    const def = flow([inputNode(), terminal]);
    expect(parseDefinition(def).success).toBe(true);
    expect(validateDefinition(def)).toEqual([]);
    expect(buildFlowGraph(def).edges).toEqual([{ from: 'ask', to: 'done', label: 'Respuesta válida' }]);
    const missing = flow([{ ...inputNode(), input: undefined }, terminal]);
    expect(parseDefinition(missing).success).toBe(false);
    expect(hasBlockingIssues(validateDefinition(missing))).toBe(true);
    const secret = inputNode();
    if (secret.input) secret.input.variable = 'password';
    expect(parseDefinition(flow([secret, terminal])).success).toBe(false);
    expect(parseDefinition({ ...def, schemaVersion: 1 }).success).toBe(false);
    const unsafe = JSON.parse(JSON.stringify(def));
    unsafe.nodes[0].input.rules.regex = '(a+)+$';
    expect(parseDefinition(unsafe).success).toBe(false);
  });
  it('rejects incompatible/inverted rules and missing destinations', () => {
    const node = inputNode('number');
    if (node.input) node.input = { ...node.input, next: 'missing', rules: { min: 10, max: 1, pattern: 'digits' } };
    expect(validateDefinition(flow([node, terminal])).filter(issue => issue.severity === 'error')).toHaveLength(3);
  });
  it.each(Object.entries(ACTION_REGISTRY).filter(([, spec]) => !spec.implemented))('warns and blocks declared action %s', (key, spec) => {
    const parsed = parseDefinition(flow([{ id: 'act', name: 'Acción', kind: 'action', body: '', options: [], action: 'handoff' }]));
    expect(parsed.success).toBe(true);
    const raw = { ...defaultDefinition(), schemaVersion: 2, entryNodeId: 'act', nodes: [{ id: 'act', name: 'Acción', kind: 'action', body: '', options: [], action: key, actionParams: Object.fromEntries(spec.requiredParams.map(param => [param, uuid])) }] };
    const result = parseDefinition(raw);
    if (!result.success) throw new Error('fixture rejected');
    expect(hasBlockingIssues(validateDefinition(result.definition))).toBe(false);
    expect(validateDefinition(result.definition)).toContainEqual(expect.objectContaining({ severity: 'warning', path: 'nodes[act].action' }));
    expect(advance(result.definition, state('act'), enter)).toMatchObject({ status: 'blocked', effects: [] });
    expect(startSimulation(result.definition).turns[0].text).toContain('blocked');
  });
  it('checks action required params and allowed variables', () => {
    const def = flow([{ id: 'act', name: 'Acción', kind: 'action', body: '', options: [], action: 'register_interest' }]);
    expect(hasBlockingIssues(validateDefinition(def))).toBe(true);
    def.nodes[0].actionParams = { categoria_id: '{{password}}', injected: 'x' };
    expect(validateDefinition(def).filter(issue => issue.severity === 'error')).toHaveLength(3);
    def.nodes[0].actionParams = { categoria_id: '{{categoria_id}}' };
    expect(hasBlockingIssues(validateDefinition(def))).toBe(false);
  });
});

describe('advance', () => {
  it.each(['text', 'number', 'image'] as const)('awaits and stores %s answers deterministically', tipo => {
    const def = flow([inputNode(tipo), terminal]);
    const initial = state();
    const waiting = advance(def, initial, enter);
    expect(waiting.state.awaiting).toEqual({ tipo, ref: 'ask', expiresAt: '2026-10-03T07:01:00.000Z' });
    expect(advance(def, initial, enter)).toEqual(waiting);
    expect(initial.awaiting).toBeNull();
    expect(advance(def, waiting.state, enter).effects).toEqual([]);
    const value = tipo === 'number' ? 42 : tipo === 'image' ? '123456789' : 'Ejemplo';
    const final = advance(def, waiting.state, { ...enter, event: { kind: 'answer', tipo, value } });
    expect(final).toMatchObject({ status: 'finished', state: { nodeId: 'done', variables: { respuesta: value }, awaiting: null } });
  });
  it('rejects invalid answers, unrequested answers, oversized state, expired and wrong-version input', () => {
    const def = flow([inputNode(), terminal]);
    const waiting = advance(def, state(), enter).state;
    const answer: ConversationInput = { ...enter, event: { kind: 'answer', tipo: 'text', value: 'https://secret.test' } };
    expect(advance(def, waiting, answer)).toMatchObject({ status: 'invalid', state: waiting, effects: [] });
    expect(advance(def, state(), answer).status).toBe('invalid');
    expect(advance(def, waiting, { ...enter, event: { kind: 'answer', tipo: 'number', value: 1 } }).status).toBe('invalid');
    expect(advance(def, waiting, { ...enter, now: '2026-10-03T07:01:00.000Z' })).toMatchObject({ status: 'expired', state: { awaiting: null } });
    expect(advance(def, waiting, { ...enter, flowVersion: 8 }).status).toBe('blocked');
    expect(advance(def, { ...waiting, owner: 'humano', awaiting: null }, enter).status).toBe('human');
    expect(advance(def, { ...state(), nodeId: 'gone' }, enter).status).toBe('blocked');
    expect(advance(def, { ...state(), variables: { secret: 'x' } }, enter).status).toBe('invalid');
  });
  it('enforces fixed text patterns, lengths, range and image ID policy', () => {
    expect(matchesSafePattern('42', 'digits')).toBe(true);
    expect(matchesSafePattern('Ána María', 'letters')).toBe(true);
    expect(matchesSafePattern('ABC 42_', 'alphanumeric')).toBe(true);
    expect(matchesSafePattern('x'.repeat(513), 'letters')).toBe(false);
    for (const [tipo, rules, value] of [
      ['text', { pattern: 'digits', minLength: 2, maxLength: 3 }, 'a'],
      ['text', { minLength: 2 }, 'a'], ['text', { maxLength: 2 }, 'aaa'],
      ['number', { min: 1, max: 10 }, 11], ['number', { min: 1 }, 0], ['image', {}, 'base64'],
    ] as const) {
      const node = inputNode(tipo);
      if (node.input) node.input.rules = rules;
      const def = flow([node, terminal]);
      const waiting = advance(def, state(), enter).state;
      expect(advance(def, waiting, { ...enter, event: { kind: 'answer', tipo, value } }).status).toBe('invalid');
    }
  });
  it.each([
    { kind: 'contact_is', value: 'cliente' }, { kind: 'active_service', categoria: uuid }, { kind: 'pending_order' },
    { kind: 'variable_equals', variable: 'respuesta', value: '123' }, { kind: 'variable_matches', variable: 'respuesta', pattern: 'digits' },
  ] as const)('evaluates closed predicate $kind against trusted context', predicate => {
    const node: BotNode = { id: 'check', name: 'Condición', kind: 'condition', body: '', options: [], condition: { predicate, yes: 'done', no: 'other' } };
    const def = flow([node, terminal, { ...terminal, id: 'other' }]);
    expect(parseDefinition(def).success).toBe(true);
    const initial = { ...state('check'), variables: { respuesta: '123' } };
    expect(advance(def, initial, enter).state.nodeId).toBe('done');
    expect(advance(def, { ...initial, variables: {} }, { ...enter, context: { contact: 'lead', activeCategories: [], pendingOrder: false } }).state.nodeId).toBe('other');
    if (!predicate.kind.startsWith('variable_')) expect(advance(def, initial, { ...enter, context: undefined }).status).toBe('blocked');
  });
  it('bounds automatic cycles and preserves v1 interactive and action transitions', () => {
    const cycle: BotNode = { id: 'check', name: 'Condición', kind: 'condition', body: '', options: [], condition: { predicate: { kind: 'pending_order' }, yes: 'check', no: 'check' } };
    expect(advance(flow([cycle]), state('check'), enter).status).toBe('blocked');
    const def = defaultDefinition();
    expect(advance(def, state(def.entryNodeId), enter).status).toBe('waiting');
    const option = def.nodes[0].options[0];
    expect(advance(def, state(def.entryNodeId), { ...enter, event: { kind: 'option', optionId: option.id } }).state.nodeId).toBe(option.next);
    expect(advance(def, state(def.entryNodeId), { ...enter, event: { kind: 'option', optionId: 'gone' } }).status).toBe('invalid');
    for (const node of def.nodes.filter(node => node.kind === 'action')) {
      expect(advance(def, state(node.id), enter).effects).toEqual([{ kind: 'action', key: node.action, params: {} }]);
    }
  });
  it('runs input and condition simulation with configurable sample context', () => {
    const ask = inputNode('number');
    if (ask.input) ask.input.next = 'check';
    const check: BotNode = { id: 'check', name: 'Condición', kind: 'condition', body: '', options: [], condition: { predicate: { kind: 'variable_equals', variable: 'respuesta', value: 42 }, yes: 'done', no: 'other' } };
    const def = flow([ask, check, terminal, { ...terminal, id: 'other', body: 'Otro' }]);
    const first = startSimulation(def);
    expect(first.finished).toBe(false);
    expect(stepSimulation(def, first, '42')).toMatchObject({ finished: true, currentNodeId: 'done' });
    expect(stepSimulation(def, first, 'abc').finished).toBe(false);
    const condition = flow([{ ...check, condition: { predicate: { kind: 'contact_is', value: 'lead' }, yes: 'done', no: 'other' } }, terminal, { ...terminal, id: 'other' }]);
    expect(startSimulation(condition, { contact: 'lead', activeCategories: [], pendingOrder: false }).currentNodeId).toBe('done');
  });
});
