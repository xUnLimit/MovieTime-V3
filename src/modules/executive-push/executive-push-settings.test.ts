import { describe, expect, it } from 'vitest';
import type { Configuracion } from '@/types';
import {
  getExecutivePushBlocksUpdate, getExecutivePushScheduleUpdate,
  getExecutivePushToggleUpdate, isExecutivePushScheduleUnchanged,
} from './executive-push-settings';

const current: Configuracion['executivePush'] = {
  enabled: false, sendTime: '09:00', windowStart: '09:00', windowEnd: '18:00',
  intervalHours: 2, timezone: 'America/Panama', selectedBlocks: ['servicios_por_pagar'],
  blockOrder: ['servicios_por_pagar'], updatedAt: new Date('2026-01-01'),
};

describe('configuracion de resumen ejecutivo', () => {
  it('alterna el envio y conserva los demas ajustes', () => {
    expect(getExecutivePushToggleUpdate(current, true, 'admin')).toMatchObject({
      enabled: true, sendTime: '09:00', updatedBy: 'admin',
    });
    expect(current.enabled).toBe(false);
  });

  it('actualiza la ventana y detecta si no cambio', () => {
    expect(isExecutivePushScheduleUnchanged({ executivePush: current, intervalHours: 2, windowStart: '09:00', windowEnd: '18:00' })).toBe(true);
    expect(isExecutivePushScheduleUnchanged({ executivePush: current, intervalHours: 3, windowStart: '09:00', windowEnd: '18:00' })).toBe(false);
    expect(getExecutivePushScheduleUpdate({ executivePush: current, intervalHours: 3, windowStart: '08:00', windowEnd: '17:00' })).toMatchObject({
      sendTime: '08:00', windowStart: '08:00', windowEnd: '17:00', intervalHours: 3,
    });
  });

  it('agrega un bloque una sola vez y lo ordena al final', () => {
    const added = getExecutivePushBlocksUpdate({ executivePush: current, blockKey: 'reposo_terminado', checked: true });
    expect(added.selectedBlocks).toEqual(['servicios_por_pagar', 'reposo_terminado']);
    expect(added.blockOrder).toEqual(['servicios_por_pagar', 'reposo_terminado']);
    expect(getExecutivePushBlocksUpdate({ executivePush: added, blockKey: 'reposo_terminado', checked: true }).selectedBlocks).toEqual(added.selectedBlocks);
  });

  it('quita un bloque de la seleccion y del orden', () => {
    const removed = getExecutivePushBlocksUpdate({ executivePush: current, blockKey: 'servicios_por_pagar', checked: false });
    expect(removed.selectedBlocks).toEqual([]);
    expect(removed.blockOrder).toEqual([]);
  });
});
