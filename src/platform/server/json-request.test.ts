import { z } from '@/platform/validation/zod';
import { describe, expect, it } from 'vitest';

import { parseJsonRequest } from './json-request';

const schema = z.object({ name: z.string().max(10) }).strict();

describe('parseJsonRequest', () => {
  it('accepts valid JSON', async () => {
    const request = new Request('https://example.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ name: 'ok' }),
    });

    await expect(parseJsonRequest(request, schema, 100)).resolves.toEqual({
      success: true,
      data: { name: 'ok' },
    });
  });

  it('rejects wrong content types and declared or actual oversized bodies', async () => {
    const wrongType = new Request('https://example.test', { method: 'POST', body: '{}' });
    expect(await parseJsonRequest(wrongType, schema, 100)).toMatchObject({ status: 400 });

    const declaredOversize = new Request('https://example.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '101' },
      body: '{}',
    });
    expect(await parseJsonRequest(declaredOversize, schema, 100)).toMatchObject({ status: 413 });

    const actualOversize = new Request('https://example.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x'.repeat(100) }),
    });
    expect(await parseJsonRequest(actualOversize, schema, 20)).toMatchObject({ status: 413 });
  });

  it('returns field errors without echoing invalid values', async () => {
    const secretValue = 'secret-value-that-must-not-be-returned';
    const request = new Request('https://example.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: secretValue, extra: secretValue }),
    });

    const result = await parseJsonRequest(request, schema, 1024);
    expect(result).toMatchObject({ success: false, status: 400, code: 'INVALID_REQUEST' });
    expect(JSON.stringify(result)).not.toContain(secretValue);
  });

  it('rejects malformed JSON', async () => {
    const request = new Request('https://example.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });
    expect(await parseJsonRequest(request, schema, 100)).toMatchObject({ status: 400 });
  });
});
