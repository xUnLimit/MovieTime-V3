import { describe, expect, it, vi } from 'vitest';

import { createLogger, redact } from './logger';

describe('observability logger', () => {
  describe('redact', () => {
    it('redacts sensitive keys at any depth', () => {
      const input = {
        userId: 'u1',
        password: 'secret123',
        nested: { token: 'abc', endpoint: 'https://push', safe: 'ok' },
        list: [{ p256dh: 'key' }, { plain: 'value' }],
      };

      expect(redact(input)).toEqual({
        userId: 'u1',
        password: '[REDACTED]',
        nested: { token: '[REDACTED]', endpoint: '[REDACTED]', safe: 'ok' },
        list: [{ p256dh: '[REDACTED]' }, { plain: 'value' }],
      });
    });

    it('reduces Error objects to name and message', () => {
      const result = redact({ error: new Error('boom') }) as { error: { name: string; message: string } };
      expect(result.error).toEqual({ name: 'Error', message: 'boom' });
    });

    it('preserves non-enumerable database error details', () => {
      const databaseError = {};
      Object.defineProperties(databaseError, {
        name: { value: 'PostgrestError', enumerable: false },
        message: { value: 'La fecha prometida fue rechazada', enumerable: false },
        code: { value: '22007', enumerable: false },
      });

      expect(redact({ error: databaseError })).toEqual({
        error: {
          name: 'PostgrestError',
          message: 'La fecha prometida fue rechazada',
          code: '22007',
        },
      });
    });

    it('preserves details from a database Error subclass', () => {
      class PostgrestError extends Error {
        code = '22007';
        details = 'La fila no cumple la regla';
        hint = 'Revisa la fecha prometida';
        override name = 'PostgrestError';
      }

      expect(
        redact({
          error: new PostgrestError('La fecha prometida fue rechazada'),
        }),
      ).toEqual({
        error: {
          name: 'PostgrestError',
          message: 'La fecha prometida fue rechazada',
          code: '22007',
          details: 'La fila no cumple la regla',
          hint: 'Revisa la fecha prometida',
        },
      });
    });

    it('passes through primitives unchanged', () => {
      expect(redact(42)).toBe(42);
      expect(redact('plain')).toBe('plain');
      expect(redact(null)).toBe(null);
    });
  });

  describe('createLogger', () => {
    it('emits scoped messages and redacts metadata', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const log = createLogger('TestScope');

      log.warn('fallback used', { rate: 1, apikey: 'should-hide' });

      expect(spy).toHaveBeenCalledWith('[TestScope] fallback used', {
        rate: 1,
        apikey: '[REDACTED]',
      });
      spy.mockRestore();
    });
  });
});
