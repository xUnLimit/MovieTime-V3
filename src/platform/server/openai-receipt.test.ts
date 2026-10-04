import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestOpenAiReceipt } from './openai-receipt';

afterEach(() => vi.unstubAllEnvs());
const image = { bytes: new ArrayBuffer(8), mimeType: 'image/png' };
function response(text = '{"reference":"YAP-1234","confidence":0.95}', status = 'completed') {
  return Response.json({ status, output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });
}
describe('receipt vision adapter', () => {
  it('does not call a provider without a key or a safe bounded image', async () => {
    vi.stubEnv('OPENAI_API_KEY', ''); const fetcher = vi.fn();
    expect(await requestOpenAiReceipt(image, 'model', fetcher)).toBeNull();
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    for (const invalid of [{ ...image, mimeType: 'text/plain' }, { ...image, bytes: new ArrayBuffer(0) },
      { ...image, bytes: new ArrayBuffer(1024 * 1024 + 1) }]) {
      expect(await requestOpenAiReceipt(invalid, 'model', fetcher)).toBeNull();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses temporary image input and a strict candidate schema without tools', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key'); const fetcher = vi.fn().mockResolvedValue(response());
    expect(await requestOpenAiReceipt(image, 'configured', fetcher)).toEqual({ reference: 'YAP-1234', confidence: 0.95 });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/responses'); expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ store: false, max_output_tokens: 256,
      text: { format: { strict: true, schema: { additionalProperties: false } } } });
    expect(body.tools).toBeUndefined();
    expect(body.input[0].content[0]).toEqual({ type: 'input_image', detail: 'low', image_url: 'data:image/png;base64,AAAAAAAAAAA=' });
  });
  it('rejects errors, incomplete/refused responses and malformed JSON', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    await expect(requestOpenAiReceipt(image, 'm', vi.fn().mockResolvedValue(new Response('private', { status: 500 }))))
      .rejects.toThrow('No se pudo leer el comprobante.');
    for (const result of [response('{}', 'incomplete'), response('x'.repeat(1025)),
      Response.json({ status: 'completed', output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'refusal' }] }] })]) {
      expect(await requestOpenAiReceipt(image, 'm', vi.fn().mockResolvedValue(result))).toBeNull();
    }
    await expect(requestOpenAiReceipt(image, 'm', vi.fn().mockResolvedValue(response('invalid')))).rejects.toThrow();
    await expect(requestOpenAiReceipt(image, 'm', vi.fn().mockResolvedValue(Response.json({})))).rejects.toThrow();
  });
});
