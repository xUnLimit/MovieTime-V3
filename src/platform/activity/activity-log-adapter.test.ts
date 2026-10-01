import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  configureActivityLogSource,
  getActivityLogContext,
  getActivityLogOptions,
  recordActivityLog,
} from './activity-log-adapter';

const log = { accion: 'crear', entidad: 'venta', entidadId: 'v-1', detalles: 'x' } as unknown as Parameters<typeof recordActivityLog>[0];

describe('activity log adapter', () => {
  afterEach(() => configureActivityLogSource(null));

  it('fails loudly when the composition root has not configured a source', () => {
    expect(() => getActivityLogOptions()).toThrow('not configured');
    expect(() => getActivityLogContext()).toThrow('not configured');
    expect(() => recordActivityLog(log)).toThrow('not configured');
  });

  it('delegates identity and recording to the injected source', async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    configureActivityLogSource({
      getContext: () => ({ usuarioId: 'u-1', usuarioEmail: 'u@test.com' }),
      record,
    });

    expect(getActivityLogContext()).toEqual({ usuarioId: 'u-1', usuarioEmail: 'u@test.com' });
    const options = getActivityLogOptions();
    expect(options.logContext).toEqual({ usuarioId: 'u-1', usuarioEmail: 'u@test.com' });
    await options.recordActivityLog(log);
    await recordActivityLog(log);
    expect(record).toHaveBeenCalledTimes(2);
  });
});
