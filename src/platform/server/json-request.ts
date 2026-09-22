import type { ZodType } from '@/platform/validation/zod';

export type ParsedJson<T> =
  | { success: true; data: T }
  | {
      success: false;
      status: 400 | 413;
      code: 'INVALID_REQUEST' | 'PAYLOAD_TOO_LARGE';
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

function toFieldErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : '_root';
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}

export async function parseJsonRequest<T>(
  request: Request,
  schema: ZodType<T>,
  maxBytes: number
): Promise<ParsedJson<T>> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    return {
      success: false,
      status: 400,
      code: 'INVALID_REQUEST',
      message: 'La solicitud debe usar application/json.',
    };
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return {
      success: false,
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'La solicitud excede el tamaño permitido.',
    };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { success: false, status: 400, code: 'INVALID_REQUEST', message: 'JSON inválido.' };
  }

  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return {
      success: false,
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'La solicitud excede el tamaño permitido.',
    };
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { success: false, status: 400, code: 'INVALID_REQUEST', message: 'JSON inválido.' };
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    return {
      success: false,
      status: 400,
      code: 'INVALID_REQUEST',
      message: 'Los datos enviados no son válidos.',
      fieldErrors: toFieldErrors(result.error.issues),
    };
  }
  return { success: true, data: result.data };
}
