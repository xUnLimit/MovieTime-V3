import { describe, expect, it } from 'vitest';

import { ApiClientError } from './contracts';
import { readApiResponse } from './client';

describe('readApiResponse', () => {
  it('returns data from the common success contract', async () => {
    const response = Response.json({ ok: true, data: { sent: 2 }, requestId: 'req-1' });
    await expect(readApiResponse<{ sent: number }>(response)).resolves.toEqual({ sent: 2 });
  });

  it.each([400, 401, 403, 413, 500, 502])(
    'turns a %i failure into ApiClientError',
    async (status) => {
      const response = Response.json(
        {
          ok: false,
          error: {
            code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INVALID_REQUEST',
            message: 'Mensaje público',
            fieldErrors: { endpoint: ['Inválido'] },
          },
          requestId: `req-${status}`,
        },
        { status }
      );

      const promise = readApiResponse(response);
      await expect(promise).rejects.toMatchObject({
        name: 'ApiClientError',
        status,
        requestId: `req-${status}`,
        message: 'Mensaje público',
      } satisfies Partial<ApiClientError>);
    }
  );

  it('uses a safe generic message when the response is not a valid contract', async () => {
    const response = new Response('SQL: secret', {
      status: 500,
      headers: { 'X-Request-Id': 'req-safe' },
    });

    await expect(readApiResponse(response)).rejects.toMatchObject({
      message: 'No se pudo completar la solicitud.',
      requestId: 'req-safe',
    });
  });
});
