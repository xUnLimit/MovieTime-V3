import { describe, expect, it } from 'vitest';

import { resizeButtonActions, suggestButtonActions } from './button-actions';
import { channelStatus, isParamMapEmpty, suggestParamMap, type MetaTemplateInfo } from './meta-template-mapping';

function meta(name: string, status: string, retired = false): MetaTemplateInfo {
  return {
    id: name, name, language: 'es', status, category: 'UTILITY', body: 'x', header: null, footer: null,
    buttons: [], paramCount: 0, retired, syncedAt: '2026-09-28T10:00:00Z',
  };
}

describe('button actions', () => {
  it('resizes to the button count and falls back to NINGUNA', () => {
    expect(resizeButtonActions(['RENOVAR', 'raro'], 3)).toEqual(['RENOVAR', 'NINGUNA', 'NINGUNA']);
    expect(resizeButtonActions(['RENOVAR', 'DATOS'], 1)).toEqual(['RENOVAR']);
    expect(resizeButtonActions(['RENOVAR'], 0)).toEqual([]);
  });

  it('suggests an action from the button text', () => {
    expect(suggestButtonActions([{ text: 'Quiero renovar' }, { text: 'No deseo continuar' }, { text: 'Ver datos' }, { text: 'Hola' }]))
      .toEqual(['RENOVAR', 'NO_CONTINUAR', 'DATOS', 'NINGUNA']);
  });
});

describe('param map suggestions and channel status', () => {
  it('suggests defaults only for 2 and 4 variables', () => {
    expect(suggestParamMap(4)).toEqual(['saludo_nombre', 'servicios', 'vencimiento', 'monto_total']);
    expect(suggestParamMap(2)).toEqual(['saludo_nombre', 'servicios']);
    expect(suggestParamMap(3)).toEqual([]);
    expect(isParamMapEmpty(['', ''])).toBe(true);
    expect(isParamMapEmpty(['servicios'])).toBe(false);
  });

  it('classifies the channel', () => {
    const list = [meta('ok', 'APPROVED'), meta('wait', 'PENDING'), meta('old', 'APPROVED', true)];
    expect(channelStatus('ok', list)).toBe('api');
    expect(channelStatus('wait', list)).toBe('pending');
    expect(channelStatus('old', list)).toBe('pending');
    expect(channelStatus('missing', list)).toBe('pending');
    expect(channelStatus(null, list)).toBe('wame');
  });
});
