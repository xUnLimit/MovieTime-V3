import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

import type { ApiErrorCode, ApiFailure, ApiSuccess } from '@/platform/api/contracts';
import { reportError } from '@/platform/observability/logger';
import { HttpError } from './api-errors';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;

export function createRequestId(): string {
  return randomUUID();
}

export function apiSuccess<T>(data: T, requestId: string, status = 200) {
  const body: ApiSuccess<T> = { ok: true, data, requestId };
  return NextResponse.json(body, {
    status,
    headers: { ...NO_STORE_HEADERS, 'X-Request-Id': requestId },
  });
}

export function apiFailure(
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId: string,
  fieldErrors?: Record<string, string[]>
) {
  const body: ApiFailure = {
    ok: false,
    error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) },
    requestId,
  };
  return NextResponse.json(body, {
    status,
    headers: { ...NO_STORE_HEADERS, 'X-Request-Id': requestId },
  });
}

export function apiErrorResponse(scope: string, requestId: string, error: unknown) {
  if (error instanceof HttpError) {
    return apiFailure(error.status, error.code, error.publicMessage, requestId);
  }

  reportError(scope, 'API request failed', error, { requestId });
  return apiFailure(
    500,
    'INTERNAL_ERROR',
    'No se pudo completar la solicitud.',
    requestId
  );
}
