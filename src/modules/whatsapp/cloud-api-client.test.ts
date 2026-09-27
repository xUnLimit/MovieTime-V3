import { describe, expect, it, vi } from 'vitest';

import { CloudApiError, sendCloudApiMessage } from './cloud-api-client';

const config = { accessToken: 'test-access-value-000000', phoneNumberId: '1324513647414207' };

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('sendCloudApiMessage', () => {
  it('posts a text message to the phone number endpoint and returns the message id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { messages: [{ id: 'wamid.OUT' }] }));

    await expect(sendCloudApiMessage(config, '50760000000', { kind: 'text', text: 'Hola' }, fetchImpl))
      .resolves.toEqual({ waMessageId: 'wamid.OUT' });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v23.0/1324513647414207/messages');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${config.accessToken}` });
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: 'whatsapp',
      to: '50760000000',
      type: 'text',
      text: { body: 'Hola', preview_url: false },
    });
  });

  it('sends template parameters as body components in Spanish', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { messages: [{ id: 'wamid.TPL' }] }));

    await sendCloudApiMessage(config, '50760000000', {
      kind: 'template',
      templateName: 'vence_hoy',
      params: ['Netflix', '27/09/2026', '$4.50'],
    }, fetchImpl);

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).template).toEqual({
      name: 'vence_hoy',
      language: { code: 'es' },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: 'Netflix' },
          { type: 'text', text: '27/09/2026' },
          { type: 'text', text: '$4.50' },
        ],
      }],
    });
  });

  it('omits components for a template without parameters', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { messages: [{ id: 'wamid.TPL' }] }));

    await sendCloudApiMessage(config, '50760000000', { kind: 'template', templateName: 'vence_hoy', params: [] }, fetchImpl);

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).template.components).toEqual([]);
  });

  it('maps a Graph error to a controlled error with the Meta code and user title', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, {
      error: { code: 131047, message: 'Re-engagement message', error_user_title: 'Mensaje fuera de ventana' },
    }));

    const error = await sendCloudApiMessage(config, '50760000000', { kind: 'text', text: 'Hola' }, fetchImpl)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CloudApiError);
    expect(error).toMatchObject({ code: 131047, title: 'Mensaje fuera de ventana' });
  });

  it('falls back to the Graph message or the HTTP status when no title is given', async () => {
    const withMessage = vi.fn().mockResolvedValue(jsonResponse(400, { error: { message: 'Invalid parameter' } }));
    const withoutBody = vi.fn().mockResolvedValue(new Response('not json', { status: 500 }));

    await expect(sendCloudApiMessage(config, '1', { kind: 'text', text: 'x' }, withMessage))
      .rejects.toMatchObject({ code: null, title: 'Invalid parameter' });
    await expect(sendCloudApiMessage(config, '1', { kind: 'text', text: 'x' }, withoutBody))
      .rejects.toMatchObject({ code: null, title: 'HTTP 500' });
  });

  it('treats a success response without a message id as an error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { messages: [] }));

    await expect(sendCloudApiMessage(config, '1', { kind: 'text', text: 'x' }, fetchImpl))
      .rejects.toBeInstanceOf(CloudApiError);
  });

  it('reports timeouts and network failures without leaking details', async () => {
    const timeout = Object.assign(new Error('aborted'), { name: 'TimeoutError' });
    const timedOut = vi.fn().mockRejectedValue(timeout);
    const offline = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    await expect(sendCloudApiMessage(config, '1', { kind: 'text', text: 'x' }, timedOut))
      .rejects.toMatchObject({ title: 'Request timed out' });
    await expect(sendCloudApiMessage(config, '1', { kind: 'text', text: 'x' }, offline))
      .rejects.toMatchObject({ title: 'Network error' });
  });
});
