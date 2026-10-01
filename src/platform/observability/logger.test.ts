import { describe, expect, it, vi } from 'vitest';

import { createLogger, redact, reportError, sanitizeText } from './logger';

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

  describe('sanitizeText', () => {
    it('sanea datos personales y credenciales sin perder identificadores tecnicos', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const input = `venta-1 ${uuid} 2026-09-30T12:30:00Z 12.50 correo a@b.com telefono +507 6000-0000 ` +
        'Bearer abc.def.ghi eyJhbGci.eyJzdWI.signature password=secreto ' +
        '"token":"oculto" https://user:pass@example.com/path';
      const safe = sanitizeText(input);
      expect(safe).toContain(`venta-1 ${uuid} 2026-09-30T12:30:00Z 12.50`);
      expect(safe).toContain('[email]');
      expect(safe).toContain('[phone]');
      expect(safe).toContain('password=[redacted]');
      expect(safe).toContain('"token":"[redacted]"');
      expect(safe).toContain('https://example.com/path');
      expect(safe.match(/\[token\]/g)).toHaveLength(2);
      for (const secret of ['a@b.com', '507 6000-0000', 'abc.def.ghi', 'eyJhbGci', 'secreto', 'oculto', 'user:pass']) {
        expect(safe).not.toContain(secret);
      }
    });

    it('acota texto largo', () => {
      const safe = sanitizeText('x'.repeat(3000));
      expect(safe).toHaveLength(2011);
      expect(safe.endsWith('[truncated]')).toBe(true);
    });
  });

  it('redacta claves personales y tolera ciclos', () => {
    const circular: Record<string, unknown> = { email: 'a@b.com', phone: '50760000000', text_body: 'secreto' };
    circular.self = circular;
    expect(redact(circular)).toEqual({
      email: '[REDACTED]', phone: '[REDACTED]', text_body: '[REDACTED]', self: '[Circular]',
    });
    expect(redact({ telefono: '50760000000', wa_id: '50760000000', payload: 'x', body: 'x', message_body: 'x' }))
      .toEqual({ telefono: '[REDACTED]', wa_id: '[REDACTED]', payload: '[REDACTED]', body: '[REDACTED]', message_body: '[REDACTED]' });
  });

  it('sanea errores SQL y causas en todos los niveles del logger', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    const cause = Object.assign(new Error('Bearer abc.def.ghi'), {
      details: 'telefono 50760000000', hint: 'token=oculto', code: 'P0001',
    });
    const error = Object.assign(new Error(`tabla ventas constraint ventas_email_key ${uuid} a@b.com`), {
      details: 'telefono 50760000000 eyJhbGci.eyJzdWI.signature',
      hint: 'password=secreto', code: '23505', cause,
    });
    const log = createLogger('Scope a@b.com');
    const spies = [vi.spyOn(console, 'log').mockImplementation(() => {}),
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
      vi.spyOn(console, 'error').mockImplementation(() => {})];
    try {
      for (const level of ['info', 'warn', 'error', 'debug'] as const) {
        log[level]('correo a@b.com', { error, note: 'telefono 50760000000' });
      }
      reportError('Scope', 'Bearer abc.def.ghi', error);
      const output = spies.flatMap((spy) => spy.mock.calls).map((args) => JSON.stringify(args)).join(' ');
      for (const secret of ['a@b.com', '50760000000', 'eyJhbGci', 'abc.def.ghi', 'secreto', 'oculto']) {
        expect(output).not.toContain(secret);
      }
      for (const technical of ['23505', 'P0001', 'ventas_email_key', uuid, '[email]', '[phone]']) {
        expect(output).toContain(technical);
      }
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });});
