import { describe, expect, it } from 'vitest';

import { ApiClientError } from '@/platform/api/contracts';
import { ValidationError } from './domain-errors';
import { getPublicErrorMessage } from './public-errors';

describe('getPublicErrorMessage', () => {
  it('returns messages from explicitly public error types', () => {
    expect(getPublicErrorMessage(new ValidationError('Dato inválido'), 'fallback')).toBe('Dato inválido');
    expect(getPublicErrorMessage(new ApiClientError('Solicitud inválida', 400, 'INVALID_REQUEST', 'req'), 'fallback'))
      .toBe('Solicitud inválida');
  });

  it('hides messages from unknown errors', () => {
    expect(getPublicErrorMessage(new Error('SQL secret'), 'Error seguro')).toBe('Error seguro');
  });
});
