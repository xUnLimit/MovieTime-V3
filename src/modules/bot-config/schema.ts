import { z } from '@/platform/validation/zod';
import type { BotDefinition, BotIssue } from '@/types/bot';
import { defaultMessages } from './defaults';

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
  any: z.boolean().optional(),
});

const blockSchema = z.object({
  type: z.enum(['catalogo', 'resumen', 'reserva', 'pago']),
  copy: z.record(z.string().max(64), z.string().max(1000)).refine((copy) => Object.keys(copy).length <= 100),
});

const nodeSchema = z.object({
  id: z.string().max(64),
  name: text,
  kind: z.enum(['buttons', 'list', 'text', 'action']),
  body: text,
  listButtonLabel: text.optional(),
  options: z.array(optionSchema).max(100),
  after: z.union([z.object({ mode: z.literal('continue') }), z.object({ mode: z.literal('wait'), hours: z.number() })]).optional(),
  action: z.enum(['netflix_login_code', 'netflix_travel_code', 'handoff', 'purchase', 'renewal', 'my_services', 'service_access']).optional(),
  block: blockSchema.optional(),
  condition: z.object({ type: z.enum(['customer_has_services', 'catalog_has_stock']) }).optional(),
});

const paramSchema = z.number();

const catalogMessagesSchema = z.object({
  categories: z.record(z.string().max(64), z.object({ chosen: text.optional(), rowDescription: text.optional() })).refine((entries) => Object.keys(entries).length <= 200),
  plans: z.record(z.string().max(64), z.object({ added: text.optional(), rowDescription: text.optional() })).refine((entries) => Object.keys(entries).length <= 200),
});

const botDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  entryNodeId: z.string().max(64),
  nodes: z.array(nodeSchema).max(200),
  messages: z.object({
    login_code_sent: text, travel_code_sent: text, travel_link_sent: text,
    login_not_found: text, travel_not_found: text, already_sent: text,
    profile_missing: text, no_netflix_account: text, rate_limited: text,
    mailbox_unavailable: text, handoff_ack: text, option_unavailable: text,
    account_picker_body: text, account_picker_button: text,
    // Mensajes agregados después: una versión ya publicada no los trae y usa el texto por defecto.
    access_none: text.optional(), access_picker_body: text.optional(), access_picker_button: text.optional(),
    access_code_notice: text.optional(), access_unavailable: text.optional(),
  }),
  params: z.object({
    menuIdleHours: paramSchema, operatorQuietMinutes: paramSchema, loginWindowMinutes: paramSchema,
    travelWindowMinutes: paramSchema, maxTaps: paramSchema, tapWindowMinutes: paramSchema,
  }),
  keywords: z.array(z.string().max(200)).max(500),
  catalogMessages: catalogMessagesSchema.optional(),
});

function pathToText(path: readonly PropertyKey[]): string {
  if (path.length === 0) return 'definición';
  return path.reduce<string>((acc, part) => {
    if (typeof part === 'number') return `${acc}[${part}]`;
    return acc === '' ? String(part) : `${acc}.${String(part)}`;
  }, '');
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
    if (result.success) {
      return { success: true, definition: { ...result.data, messages: { ...defaultMessages(), ...result.data.messages } } };
    }
    const issues = result.error.issues.slice(0, MAX_ISSUES).map((issue): BotIssue => ({
      path: pathToText(issue.path), message: describe(issue), severity: 'error',
    }));
    return { success: false, issues };
  } catch {
    return { success: false, issues: [{ path: 'definición', message: 'No se pudo leer la definición.', severity: 'error' }] };
  }
}
