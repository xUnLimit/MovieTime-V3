import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLogger, reportError } from './logger';

afterEach(() => vi.restoreAllMocks());

describe('thrown value diagnostics', () => {
  it.each([
    [undefined, 'undefined', null, '[undefined]'],
    [null, 'null', null, null],
    [false, 'boolean', 'Boolean', false],
    [12, 'number', 'Number', 12],
    [BigInt(12), 'bigint', 'BigInt', '12'],
    ['token=private', 'string', 'String', 'token=[redacted]'],
    [Symbol('failure'), 'symbol', 'Symbol', 'Symbol(failure)'],
  ])('records a thrown %s without losing its type', (value, type, constructor, diagnostic) => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError('Renewal', 'failed', value);
    expect(spy).toHaveBeenCalledWith('[Renewal] failed', {
      error: { type, constructor, value: diagnostic },
    });
    expect(() => JSON.stringify(spy.mock.calls)).not.toThrow();
  });

  it('records non-enumerable diagnostics without requiring a message', () => {
    class DatabaseFailure {}
    const failure = new DatabaseFailure();
    Object.defineProperties(failure, {
      code: { value: '23503' }, details: { value: 'correo fixture@example.test' },
      message: { value: undefined }, password: { value: 'hidden' },
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError('Renewal', 'failed', failure);
    expect(spy).toHaveBeenCalledWith('[Renewal] failed', {
      error: { type: 'object', constructor: 'DatabaseFailure', code: '23503', details: 'correo [email]' },
    });
  });

  it('records empty objects and native errors, including sanitized causes', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    reportError('Renewal', 'failed', {});
    expect(spy).toHaveBeenLastCalledWith('[Renewal] failed', {
      error: { type: 'object', constructor: 'Object' },
    });
    reportError('Renewal', 'failed', new Error('password=hidden', { cause: undefined }));
    expect(spy).toHaveBeenLastCalledWith('[Renewal] failed', {
      error: { type: 'object', constructor: 'Error', name: 'Error', message: 'password=[redacted]',
        cause: { type: 'undefined', constructor: null, value: '[undefined]' } },
    });
  });

  it('handles cyclic causes, objects without prototypes and throwing getters', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = Object.create(null) as Record<string, unknown>;
    failure.cause = failure;
    Object.defineProperty(failure, 'message', { get() { throw new Error('private'); } });
    expect(() => reportError('Renewal', 'failed', failure)).not.toThrow();
    expect(spy).toHaveBeenCalledWith('[Renewal] failed', {
      error: { type: 'object', constructor: null, message: '[Unreadable]', cause: '[Circular]' },
    });
  });

  it('also records thrown values supplied to createLogger', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createLogger('Renewal').warn('failed', { error: undefined, token: 'private' });
    expect(spy).toHaveBeenCalledWith('[Renewal] failed', {
      error: { type: 'undefined', constructor: null, value: '[undefined]' }, token: '[REDACTED]',
    });
  });
});
