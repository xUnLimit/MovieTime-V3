import {
  buildNodeMessage, MESSAGE_CATALOG, renderTemplate, templateVariables, VARIABLE_CATALOG,
} from '@/modules/bot-config';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import type { OutboundResult } from '@/modules/whatsapp/outbound-messages';
import type { BotActionKey, BotDefinition, BotMessageKey } from '@/types/bot';
import { reply, type BotRun } from './bot-reply';

const BLANK_VALUES = Object.fromEntries(Object.keys(VARIABLE_CATALOG).map((name) => [name, '']));

// Renders a system message of the published bot. A text that lost a required marker (for
// example the code) falls back to the default wording, so a code is never sent without
// the code and nothing here can throw. Markers without a value render empty.
export function renderBotMessage(
  definition: BotDefinition, key: BotMessageKey, values: Record<string, string> = {},
): string {
  const spec = MESSAGE_CATALOG[key];
  const text = definition.messages[key];
  const used = typeof text === 'string' ? templateVariables(text) : [];
  const usable = typeof text === 'string' && text.trim() !== '' && spec.required.every((name) => used.includes(name));
  return renderTemplate(usable ? text : spec.defaultText, { ...BLANK_VALUES, ...values });
}

export function sayMessage(run: BotRun, key: BotMessageKey, values?: Record<string, string>, prefix?: string): Promise<OutboundResult> {
  const text = renderBotMessage(run.deps.definition, key, values);
  return reply(run.deps, run.message, { kind: 'text', text: prefix ? `${prefix}

${text}` : text });
}

// "Try again" messages invite the customer to tap the same button again: the one of the
// menu that leads to this action, when the flow still has it.
export function messageWithRetryButton(definition: BotDefinition, action: BotActionKey, text: string): OutboundPayload {
  for (const node of definition.nodes) {
    if (node.kind !== 'buttons') continue;
    const option = node.options.find((candidate) => definition.nodes.some(
      (target) => target.id === candidate.next && target.kind === 'action' && target.action === action,
    ));
    if (option) return buildNodeMessage({ ...node, body: text, options: [option] });
  }
  return { kind: 'text', text };
}
