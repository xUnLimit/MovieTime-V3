import { describe, expect, it, vi } from 'vitest';

import {
  assertRecordId,
  assertRpcStringId,
  assertUuid,
  logAsyncSideEffectError,
  safeAsyncSideEffect,
  safeInternalPath,
  toMoneyNumber,
} from './safety';

describe('safety assertions', () => {
  it('validates UUID input', () => {
    expect(assertUuid('123e4567-e89b-12d3-a456-426614174000', 'id')).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(() => assertUuid('DROP-TABLE', 'id')).toThrow('id debe ser un UUID valido');
  });

  it('rejects malformed RPC ids instead of stringifying objects', () => {
    expect(assertRpcStringId('abc-123', 'rpc')).toBe('abc-123');
    expect(() => assertRpcStringId({}, 'rpc')).toThrow('rpc no retorno un id valido');
    expect(() => assertRpcStringId(null, 'rpc')).toThrow('rpc no retorno un id valido');
  });

  it('extracts record ids defensively', () => {
    expect(assertRecordId({ id: 'row-1' }, 'insert')).toBe('row-1');
    expect(() => assertRecordId(undefined, 'insert')).toThrow('insert no retorno un registro con id');
    expect(() => assertRecordId({ id: '' }, 'insert')).toThrow('insert retorno un id invalido');
  });

  it('normalizes money values and rejects invalid amounts', () => {
    expect(toMoneyNumber('10.50')).toBe(10.5);
    expect(() => toMoneyNumber('abc')).toThrow('monto debe ser un numero valido');
  });

  it('keeps navigation paths internal when reading return URLs', () => {
    expect(safeInternalPath('/servicios/crear?from=/servicios', '/servicios')).toBe('/servicios/crear?from=/servicios');
    expect(safeInternalPath('servicios', '/servicios')).toBe('/servicios');
    expect(safeInternalPath('https://evil.example/phish', '/servicios')).toBe('/servicios');
    expect(safeInternalPath('//evil.example/phish', '/servicios')).toBe('/servicios');
    expect(safeInternalPath('/\\evil.example', '/servicios')).toBe('/servicios');
  });

  it('logs side-effect failures with operation context', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    safeAsyncSideEffect(Promise.reject(new Error('boom')), {
      operation: 'sync',
      entity: 'venta',
      entityId: 'venta-1',
    });

    await vi.waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        '[SideEffect] sync entity=venta id=venta-1',
        { error: expect.objectContaining({ message: 'boom' }) }
      );
    });
    spy.mockRestore();
  });

  it('logs awaited side-effect failures with the same operation context', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logAsyncSideEffectError(new Error('boom'), {
      operation: 'sync',
      entity: 'venta',
      entityId: 'venta-1',
    });

    expect(spy).toHaveBeenCalledWith(
      '[SideEffect] sync entity=venta id=venta-1',
      { error: expect.objectContaining({ message: 'boom' }) }
    );
    spy.mockRestore();
  });

  it('marks critical side-effect failures in the log scope', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logAsyncSideEffectError(new Error('boom'), { operation: 'sync', critical: true });

    expect(spy).toHaveBeenCalledWith('[SideEffect:CRITICAL] sync', expect.any(Object));
    spy.mockRestore();
  });
});
