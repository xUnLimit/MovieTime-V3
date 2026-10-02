import { z } from '@/platform/validation/zod';
import type { BotDefinition, BotIssue } from '@/types/bot';
import { isActionKey, type RegisteredActionKey } from './action-registry';
import { conditionSpecSchema, inputSpecSchema } from './v2-schema';

// El esquema solo comprueba forma y topes generosos (defensa ante entrada hostil).
// Los limites de negocio y de WhatsApp los aplica `validateDefinition`.
const TEXT_CAP = 4096;
const text = z.string().max(TEXT_CAP);
const MAX_ISSUES = 50;

const optionSchema = z.object({
  id: z.string().max(64),
  title: text,
  description: text.optional(),
  next: z.string().max(64),
});

const nodeSchema = z.object({
  id: z.string().max(64),
  name: text,
  kind: z.enum(['buttons', 'list', 'text', 'action', 'input', 'condition']),
  body: text,
  listButtonLabel: text.optional(),
  options: z.array(optionSchema).max(100),
  action: z.custom<RegisteredActionKey>(value => typeof value === 'string' && isActionKey(value)).optional(),
  actionParams: z.record(z.string().max(32), z.string().max(512)).optional(),
  input: inputSpecSchema.optional(),
  condition: conditionSpecSchema.optional(),
});

const paramSchema = z.number();

const botDefinitionSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  entryNodeId: z.string().max(64),
  nodes: z.array(nodeSchema).max(200),
  messages: z.object({
    login_code_sent: text, travel_code_sent: text, travel_link_sent: text,
    login_not_found: text, travel_not_found: text, already_sent: text,
    profile_missing: text, no_netflix_account: text, rate_limited: text,
    mailbox_unavailable: text, handoff_ack: text, option_unavailable: text,
    account_picker_body: text, account_picker_button: text,
  }),
  params: z.object({
    menuIdleHours: paramSchema, operatorQuietMinutes: paramSchema, loginWindowMinutes: paramSchema,
    travelWindowMinutes: paramSchema, maxTaps: paramSchema, tapWindowMinutes: paramSchema,
  }),
  keywords: z.array(z.string().max(200)).max(500),
}).superRefine((def, ctx) => {
  def.nodes.forEach((node, index) => {
    if (def.schemaVersion === 1 && (node.kind === 'input' || node.kind === 'condition' || node.input || node.condition || node.actionParams ||
      (node.action && !['netflix_login_code', 'netflix_travel_code', 'handoff'].includes(node.action)))) {
      ctx.addIssue({ code: 'custom', path: ['nodes', index], message: 'Requires v2' });
    }
    if ((node.kind === 'input') !== Boolean(node.input) || (node.kind === 'condition') !== Boolean(node.condition)) {
      ctx.addIssue({ code: 'custom', path: ['nodes', index], message: 'Invalid node configuration' });
    }
  });
});

function pathToText(path: readonly PropertyKey[]): string {
  if (path.length === 0) return 'definición';
  return path.reduce<string>((acc, part) => {
    if (typeof part === 'number') return `${acc}[${part}]`;
    return acc === '' ? String(part) : `${acc}.${String(part)}`;
  }, '');
}

/** Explicit, idempotent upgrade; never mutates the persisted v1 JSON. */
export function upgradeDefinition(definition: BotDefinition): BotDefinition & { schemaVersion: 2 } {
  return { ...structuredClone(definition), schemaVersion: 2 };
}

function describe(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type': return 'El tipo de dato no es válido.';
    case 'too_big': return 'El valor es demasiado grande o largo.';
    case 'invalid_value': return 'El valor no está permitido.';
    default: return 'El valor no es válido.';
  }
}

/** Valida la forma de la definicion; nunca lanza. */
export function parseDefinition(input: unknown):
  { success: true; definition: BotDefinition } | { success: false; issues: BotIssue[] } {
  try {
    const result = botDefinitionSchema.safeParse(input);
    if (result.success) return { success: true, definition: result.data };
    const issues = result.error.issues.slice(0, MAX_ISSUES).map((issue): BotIssue => ({
      path: pathToText(issue.path), message: describe(issue), severity: 'error',
    }));
    // Also identify the format whose validation failed. Keep detailed field diagnostics,
    // including for malformed v2 JSON that an older editor cannot interpret.
    const format = z.object({ schemaVersion: z.literal(2) }).safeParse(input);
    if (format.success) {
      if (issues.length === MAX_ISSUES) issues.pop();
      issues.push({ path: 'schemaVersion', message: 'La definición no cumple el formato permitido para su versión.', severity: 'error' });
    }
    return { success: false, issues };
  } catch {
    return { success: false, issues: [{ path: 'definición', message: 'No se pudo leer la definición.', severity: 'error' }] };
  }
}
