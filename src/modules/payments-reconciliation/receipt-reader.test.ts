import { describe, expect, it, vi } from 'vitest';
import {
  createChainedReceiptReader, createManualReceiptReader, createReceiptReaderFromEnv, createVisionReceiptReader,
  parseVisionReply,
} from './receipt-reader';

const reply = (text: string) => ({ content: [{ type: 'text', text }] });
const image = { base64: 'AAAA', mimeType: 'image/png' as const };

describe('parseVisionReply', () => {
  it('extracts a valid code from the JSON answer', () => {
    expect(parseVisionReply(reply('{"codigo": "gzcss-20613095"}'))).toBe('GZCSS-20613095');
    expect(parseVisionReply(reply('Aqui: {"codigo":"GZCSS-20613095"} listo'))).toBe('GZCSS-20613095');
  });

  it('rejects null, malformed, invented or unexpected answers', () => {
    expect(parseVisionReply(reply('{"codigo": null}'))).toBeNull();
    expect(parseVisionReply(reply('{"codigo": "12345"}'))).toBeNull();
    expect(parseVisionReply(reply('no json'))).toBeNull();
    expect(parseVisionReply(reply('{"codigo": '))).toBeNull();
    expect(parseVisionReply({ content: [] })).toBeNull();
    expect(parseVisionReply(null)).toBeNull();
    expect(parseVisionReply({ content: [{ type: 'image' }] })).toBeNull();
  });
});

describe('receipt readers', () => {
  it('manual reader only uses the typed text', async () => {
    const reader = createManualReceiptReader();
    expect(await reader.read({ typedCode: 'GZCSS-20613095' })).toEqual({ code: 'GZCSS-20613095', source: 'texto' });
    expect(await reader.read({ imageMediaId: 'm1' })).toEqual({ code: null, source: 'ninguna' });
  });

  it('vision reader posts the image to the Messages API and parses the answer', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(reply('{"codigo":"GZCSS-20613095"}')), { status: 200 }));
    const reader = createVisionReceiptReader({ apiKey: 'k', model: 'm', loadImage: async () => image, fetchImpl });
    expect(await reader.read({ imageMediaId: 'm1' })).toEqual({ code: 'GZCSS-20613095', source: 'vision' });
    const [url, init] = fetchImpl.mock.calls[0];
    if (!init) throw new Error('missing init');
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('k');
  });

  it('vision reader degrades to no code on http errors, missing media and exceptions', async () => {
    const bad = createVisionReceiptReader({ apiKey: 'k', model: 'm', loadImage: async () => image,
      fetchImpl: (async () => new Response('x', { status: 500 })) as unknown as typeof fetch });
    expect((await bad.read({ imageMediaId: 'm1' })).code).toBeNull();
    const none = createVisionReceiptReader({ apiKey: 'k', model: 'm', loadImage: async () => null, fetchImpl: vi.fn() });
    expect((await none.read({ imageMediaId: 'm1' })).code).toBeNull();
    const boom = createVisionReceiptReader({ apiKey: 'k', model: 'm', loadImage: async () => { throw new Error('x'); } });
    expect((await boom.read({ imageMediaId: 'm1' })).code).toBeNull();
    expect((await boom.read({})).source).toBe('ninguna');
  });

  it('chained reader prefers text and only falls back for images', async () => {
    const fallback = { read: vi.fn(async () => ({ code: 'ZZZZZ-12345678', source: 'vision' as const })) };
    const reader = createChainedReceiptReader(createManualReceiptReader(), fallback);
    expect((await reader.read({ typedCode: 'GZCSS-20613095', imageMediaId: 'm' })).code).toBe('GZCSS-20613095');
    expect(fallback.read).not.toHaveBeenCalled();
    expect((await reader.read({ typedCode: 'hola' })).code).toBeNull();
    expect((await reader.read({ imageMediaId: 'm' })).source).toBe('vision');
  });

  it('is manual unless the flag and credentials are all present', async () => {
    const fetchImpl = vi.fn();
    const load = async () => image;
    for (const env of [{}, { RECEIPT_VISION_ENABLED: 'false', ANTHROPIC_API_KEY: 'k', RECEIPT_VISION_MODEL: 'm' },
      { RECEIPT_VISION_ENABLED: 'true', ANTHROPIC_API_KEY: 'k' }]) {
      expect((await createReceiptReaderFromEnv(env, load, fetchImpl).read({ imageMediaId: 'm' })).code).toBeNull();
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    const okFetch = (async () => new Response(JSON.stringify(reply('{"codigo":"GZCSS-20613095"}')), { status: 200 })) as unknown as typeof fetch;
    const enabled = createReceiptReaderFromEnv(
      { RECEIPT_VISION_ENABLED: 'true', ANTHROPIC_API_KEY: 'k', RECEIPT_VISION_MODEL: 'm' }, load, okFetch);
    expect((await enabled.read({ imageMediaId: 'm' })).code).toBe('GZCSS-20613095');
  });
});
