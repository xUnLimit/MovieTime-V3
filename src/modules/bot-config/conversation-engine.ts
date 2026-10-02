import type { BotDefinition, BotNode } from '@/types/bot';
import { z } from '@/platform/validation/zod';
import { conversationStateSchema, variablesSchema, type ConversationState } from '@/platform/validation/conversation-state';
import { ACTION_REGISTRY, isActionKey, type RegisteredActionKey } from './action-registry';
import { parseDefinition } from './schema';
import { hasBlockingIssues, validateDefinition } from './validate';
import { buildNodeMessage, type BotOutboundMessage } from './payload';
import type { ConditionSpec, InputSpec, SafePattern } from './v2-schema';

const contextSchema = z.object({
  contact: z.enum(['lead', 'cliente']), activeCategories: z.array(z.string().uuid()).max(100), pendingOrder: z.boolean(),
}).strict();
const inputSchema = z.object({
  now: z.iso.datetime({ offset: true }), flowVersion: z.number().int().positive(), context: contextSchema.optional(),
  event: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('enter') }).strict(),
    z.object({ kind: z.literal('option'), optionId: z.string().max(32) }).strict(),
    z.object({ kind: z.literal('answer'), tipo: z.enum(['text', 'number', 'image']), value: z.union([z.string().max(512), z.number().finite()]) }).strict(),
  ]),
}).strict();
export type ConversationInput = z.infer<typeof inputSchema>;
type ConversationEffect = { kind: 'message'; message: BotOutboundMessage } |
  { kind: 'action'; key: RegisteredActionKey; params: Record<string, string> };
export type ConversationTransition = {
  state: ConversationState; effects: ConversationEffect[];
  status: 'waiting' | 'finished' | 'human' | 'invalid' | 'expired' | 'blocked';
};

// Linear bounded patterns, selected from code. Never compile admin text as regex.
export function matchesSafePattern(value: string, pattern: SafePattern): boolean {
  if (value.length > 512) return false;
  switch (pattern) {
    case 'digits': return /^[0-9]+$/.test(value);
    case 'letters': return /^[\p{L} ]+$/u.test(value);
    case 'alphanumeric': return /^[\p{L}\p{N} _-]+$/u.test(value);
  }
}
function accepts(spec: InputSpec, tipo: string, value: string | number): boolean {
  if (tipo !== spec.tipo) return false;
  const rules = spec.rules;
  if (tipo === 'number') return typeof value === 'number' && value >= (rules.min ?? -Infinity) && value <= (rules.max ?? Infinity);
  if (typeof value !== 'string') return false;
  if (tipo === 'image') return /^[0-9]{1,64}$/.test(value); // opaque media ID, never content or signed URLs
  return value.length >= (rules.minLength ?? 1) && value.length <= (rules.maxLength ?? 512) &&
    (!rules.pattern || matchesSafePattern(value, rules.pattern));
}
function predicate(spec: ConditionSpec, state: ConversationState, context: ConversationInput['context']): boolean | null {
  const p = spec.predicate;
  switch (p.kind) {
    case 'contact_is': return context ? context.contact === p.value : null;
    case 'active_service': return context ? context.activeCategories.includes(p.categoria) : null;
    case 'pending_order': return context ? context.pendingOrder : null;
    case 'variable_equals': return Object.hasOwn(state.variables, p.variable) && state.variables[p.variable] === p.value;
    case 'variable_matches': {
      const value = state.variables[p.variable];
      return typeof value === 'string' && matchesSafePattern(value, p.pattern);
    }
  }
}
function actionParams(node: BotNode, state: ConversationState): Record<string, string> | null {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(node.actionParams ?? {})) {
    const variable = /^\{\{([a-z][a-z0-9_]{0,31})\}\}$/.exec(value)?.[1];
    if (variable && (!Object.hasOwn(state.variables, variable) || state.variables[variable] === null)) return null;
    params[key] = variable ? String(state.variables[variable]) : value;
  }
  return params;
}

/** Pure reducer. Context is supplied by the server, never by the customer or definition. */
export function advance(definition: BotDefinition, original: ConversationState, rawInput: ConversationInput): ConversationTransition {
  const result = (status: ConversationTransition['status'], state = original, effects: ConversationEffect[] = []): ConversationTransition => ({ state, effects, status });
  const parsed = parseDefinition(definition);
  const inputResult = inputSchema.safeParse(rawInput);
  if (!parsed.success || hasBlockingIssues(validateDefinition(parsed.definition)) || !conversationStateSchema.safeParse(original).success || !inputResult.success) return result('invalid');
  const input = inputResult.data;
  if (original.owner === 'humano') return result('human');
  if (input.flowVersion !== original.flowVersion) return result('blocked');
  const now = Date.parse(input.now);
  let state = { ...original, variables: { ...original.variables } };
  let node = definition.nodes.find(candidate => candidate.id === state.nodeId);
  if (!node) return result('blocked');
  if (state.awaiting && Date.parse(state.awaiting.expiresAt) <= now) return result('expired', { ...state, awaiting: null });
  if (input.event.kind === 'answer') {
    if (node.kind !== 'input' || !node.input || !state.awaiting || state.awaiting.ref !== node.id ||
      state.awaiting.tipo !== input.event.tipo || !accepts(node.input, input.event.tipo, input.event.value)) return result('invalid');
    const variables = { ...state.variables, [node.input.variable]: input.event.value };
    if (!variablesSchema.safeParse(variables).success) return result('invalid');
    state = { ...state, variables, awaiting: null, nodeId: node.input.next };
  } else if (input.event.kind === 'option') {
    if (state.awaiting || (node.kind !== 'buttons' && node.kind !== 'list')) return result('invalid');
    const optionId = input.event.optionId;
    const option = node.options.find(candidate => candidate.id === optionId);
    if (!option) return result('invalid');
    state = { ...state, nodeId: option.next };
  } else if (state.awaiting) return result('waiting'); // do not extend the deadline on re-entry
  const visited = new Set<string>();
  while (!visited.has(state.nodeId)) {
    visited.add(state.nodeId);
    node = definition.nodes.find(candidate => candidate.id === state.nodeId);
    if (!node) return result('blocked', state);
    if (node.kind === 'condition' && node.condition) {
      const matches = predicate(node.condition, state, input.context);
      if (matches === null) return result('blocked', state);
      state = { ...state, nodeId: matches ? node.condition.yes : node.condition.no };
      continue;
    }
    if (node.kind === 'action') {
      if (!node.action || !isActionKey(node.action) || !ACTION_REGISTRY[node.action].implemented) return result('blocked', state);
      const params = actionParams(node, state);
      if (!params) return result('blocked', state);
      if (node.action === 'handoff') state = { ...state, owner: 'humano', awaiting: null };
      return result('finished', state, [{ kind: 'action', key: node.action, params }]);
    }
    if (node.kind === 'input' && node.input) {
      state = { ...state, awaiting: { tipo: node.input.tipo, ref: node.id, expiresAt: new Date(now + node.input.timeoutSeconds * 1000).toISOString() } };
    }
    return result(node.kind === 'text' ? 'finished' : 'waiting', state, [{ kind: 'message', message: buildNodeMessage(node) }]);
  }
  return result('blocked', state); // bounded automatic traversal
}
