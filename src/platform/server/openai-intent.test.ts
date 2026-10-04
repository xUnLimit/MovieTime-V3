import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestOpenAiIntent } from './openai-intent';

afterEach(() => vi.unstubAllEnvs());
function response(output: unknown, status = 'completed') {
  return Response.json({ status, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] });
}
describe('OpenAI intent adapter', () => {
  it('does not contact OpenAI without server configuration', async () => {
    vi.stubEnv('OPENAI_API_KEY', ''); const fetcher = vi.fn();
    expect(await requestOpenAiIntent('hello', 'model', fetcher)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses structured output, timeout and store false without tools or identities', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const fetcher = vi.fn().mockResolvedValue(response({ intent: 'clarify' }));
    expect(await requestOpenAiIntent('hello', 'configured-model', fetcher)).toEqual({ intent: 'clarify' });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: 'configured-model', store: false, max_output_tokens: 512,
      text: { format: { type: 'json_schema', strict: true } } });
    expect(body.tools).toBeUndefined();
    expect(body.input).toEqual([{ role: 'user', content: [{ type: 'input_text', text: 'hello' }] }]);
  });
  it('hides provider errors and refuses incomplete, missing and oversized output', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    await expect(requestOpenAiIntent('a', 'b', vi.fn().mockResolvedValue(new Response('secret', { status: 429 }))))
      .rejects.toThrow('La interpretación de IA no está disponible.');
    expect(await requestOpenAiIntent('a', 'b', vi.fn().mockResolvedValue(response({}, 'incomplete')))).toBeNull();
    expect(await requestOpenAiIntent('a', 'b', vi.fn().mockResolvedValue(Response.json({ status: 'completed', output: [] })))).toBeNull();
    expect(await requestOpenAiIntent('a', 'b', vi.fn().mockResolvedValue(response('x'.repeat(5000))))).toBeNull();
    expect(await requestOpenAiIntent('a', 'b', vi.fn().mockResolvedValue(Response.json({ status: 'completed', output: [{ type: 'reasoning' },
      { type: 'message', content: [{ type: 'refusal' }] }] })))).toBeNull();
    await expect(requestOpenAiIntent('a', 'b', vi.fn().mockResolvedValue(Response.json({ output: [] })))).rejects.toThrow();
  });
});
