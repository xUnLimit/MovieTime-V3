import { ApiClientError, type ApiResponse } from './contracts';

export async function readApiResponse<T>(response: Response): Promise<T> {
  let payload: ApiResponse<T> | null = null;
  try {
    payload = await response.json() as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || payload.ok !== true) {
    if (payload && payload.ok === false) {
      throw new ApiClientError(
        payload.error.message,
        response.status,
        payload.error.code,
        payload.requestId,
        payload.error.fieldErrors
      );
    }
    throw new ApiClientError(
      'No se pudo completar la solicitud.',
      response.status,
      'INTERNAL_ERROR',
      response.headers.get('x-request-id') ?? 'unknown'
    );
  }

  return payload.data;
}
