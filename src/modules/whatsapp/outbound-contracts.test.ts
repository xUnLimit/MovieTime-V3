import { describe, expect, it } from 'vitest';

import { sendWhatsAppMessageSchema } from './outbound-contracts';

const base = { idempotencyKey: '5b0f3c3e-8d8f-4c55-9a4b-3c9f1a2b7d10', to: '50760000000' };

function parseTemplate(templateName: string, params: string[], buttonPayloads?: string[]) {
  return sendWhatsAppMessageSchema.safeParse({ ...base, message: {
    kind: 'template', templateName, params, ...(buttonPayloads ? { buttonPayloads } : {}),
  } });
}

describe('template sending contract', () => {
  it('accepts a new Meta name and three quick reply payloads', () => {
    expect(parseTemplate('aviso_vence_hoy', ['Hola Ana'], ['ONE', 'TWO', 'THREE']).success).toBe(true);
  });

  it.each(['Uppercase', 'hyphen-name', '', 'x'.repeat(513)])('rejects invalid Meta name %s', (name) => {
    expect(parseTemplate(name, []).success).toBe(false);
  });

  it('limits quick replies to three payloads of 256 characters', () => {
    expect(parseTemplate('aviso_vence_hoy', [], ['x'.repeat(256)]).success).toBe(true);
    expect(parseTemplate('aviso_vence_hoy', [], ['x'.repeat(257)]).success).toBe(false);
    expect(parseTemplate('aviso_vence_hoy', [], ['a', 'b', 'c', 'd']).success).toBe(false);
  });

  it.each(['line\nbreak', 'tab\tvalue', 'x'.repeat(257)])('rejects an invalid body parameter', (param) => {
    expect(parseTemplate('aviso_vence_hoy', [param]).success).toBe(false);
  });
});
