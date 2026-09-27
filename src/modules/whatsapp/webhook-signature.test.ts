import { createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { isValidVerifyToken, isValidWebhookSignature } from './webhook-signature';

// Claves generadas por ejecucion: no hay credenciales fijas en el repositorio.
const SIGNING_FIXTURE = randomBytes(32).toString('hex');
const OTHER_SIGNING_FIXTURE = randomBytes(32).toString('hex');
const sign = (body: string, secret = SIGNING_FIXTURE) =>
  `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;

describe('isValidWebhookSignature', () => {
  const body = '{"object":"whatsapp_business_account","entry":[]}';

  it('accepts the HMAC-SHA256 signature Meta computes over the raw body', () => {
    expect(isValidWebhookSignature(body, sign(body), SIGNING_FIXTURE)).toBe(true);
  });

  it('accepts an uppercase hex digest', () => {
    const header = `sha256=${sign(body).slice('sha256='.length).toUpperCase()}`;
    expect(isValidWebhookSignature(body, header, SIGNING_FIXTURE)).toBe(true);
  });

  it('rejects a body that was modified after signing', () => {
    expect(isValidWebhookSignature(`${body} `, sign(body), SIGNING_FIXTURE)).toBe(false);
  });

  it('rejects a signature made with another secret', () => {
    expect(isValidWebhookSignature(body, sign(body, OTHER_SIGNING_FIXTURE), SIGNING_FIXTURE)).toBe(false);
  });

  it.each([
    ['missing header', null],
    ['wrong prefix', `sha1=${'a'.repeat(64)}`],
    ['non hex digest', `sha256=${'z'.repeat(64)}`],
    ['short digest', 'sha256=abcd'],
  ])('rejects a %s', (_label, header) => {
    expect(isValidWebhookSignature(body, header, SIGNING_FIXTURE)).toBe(false);
  });

  it('rejects everything when no secret is configured', () => {
    expect(isValidWebhookSignature(body, sign(body, ''), '')).toBe(false);
  });
});

describe('isValidVerifyToken', () => {
  it('matches the configured token', () => {
    expect(isValidVerifyToken('verify-token-123456', 'verify-token-123456')).toBe(true);
  });

  it.each([
    ['a different token', 'other-token-1234567'],
    ['a missing token', null],
    ['an empty token', ''],
  ])('rejects %s', (_label, provided) => {
    expect(isValidVerifyToken(provided, 'verify-token-123456')).toBe(false);
  });

  it('rejects everything when no token is configured', () => {
    expect(isValidVerifyToken('anything', '')).toBe(false);
  });
});
