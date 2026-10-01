import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ update: vi.fn(), executive: vi.fn(), runs: vi.fn() }));
vi.mock('@/platform/supabase/config-repository', () => ({
  getConfig: vi.fn(),
  updateExecutivePushSettings: mocks.executive,
  updateWhatsappAutoSettings: mocks.update,
}));
vi.mock('@/platform/supabase/auto-notice-runs-repository', () => ({ listRecentAutoNoticeRuns: mocks.runs }));

import { getConfigUseCase, listAutoNoticeRunsUseCase, updateExecutivePushUseCase, updateWhatsAppAutoUseCase } from './config-use-cases';
import { getConfig } from '@/platform/supabase/config-repository';
import type { ExecutivePushSettings } from '@/types';

describe('updateWhatsAppAutoUseCase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps the fields to columns', async () => {
    await updateWhatsAppAutoUseCase({ enabled: true, dailyCap: 150, horaEnvio: 9 });
    expect(mocks.update).toHaveBeenCalledWith({ whatsapp_auto_enabled: true, whatsapp_auto_daily_cap: 150, hora_envio: 9 });
  });

  it('clamps the cap to 1..1000 and the hour to 0..23', async () => {
    await updateWhatsAppAutoUseCase({ dailyCap: 5000, horaEnvio: 30 });
    expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({ whatsapp_auto_daily_cap: 1000, hora_envio: 23 }));
    await updateWhatsAppAutoUseCase({ dailyCap: 0, horaEnvio: -2 });
    expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({ whatsapp_auto_daily_cap: 1, hora_envio: 0 }));
  });

  it('leaves untouched fields undefined', async () => {
    await updateWhatsAppAutoUseCase({ enabled: false });
    expect(mocks.update).toHaveBeenCalledWith({ whatsapp_auto_enabled: false, whatsapp_auto_daily_cap: undefined, hora_envio: undefined });
  });

  it('reads the last 7 runs', async () => {
    mocks.runs.mockResolvedValue([]);
    await listAutoNoticeRunsUseCase();
    expect(mocks.runs).toHaveBeenCalledWith(7);
  });
});

const current: ExecutivePushSettings = {
  enabled: false, sendTime: '09:00', windowStart: '08:00', windowEnd: '18:00',
  intervalHours: 2, timezone: 'America/Panama', selectedBlocks: ['servicios_por_pagar'],
  blockOrder: ['servicios_por_pagar'], updatedAt: new Date('2026-01-01'),
};

describe('updateExecutivePushUseCase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('consulta la configuracion', () => {
    getConfigUseCase();
    expect(getConfig).toHaveBeenCalledOnce();
  });

  it('no borra la ultima entrega si no cambia el horario', () => {
    updateExecutivePushUseCase({ enabled: false }, current);
    expect(mocks.executive).toHaveBeenCalledWith(expect.not.objectContaining({ executive_push_last_sent_at: null }));
  });

  it.each([
    { enabled: true }, { sendTime: '10:00' }, { windowStart: '07:00' },
    { windowEnd: '19:00' }, { intervalHours: 3 }, { timezone: 'UTC' },
    { selectedBlocks: [] }, { blockOrder: [] },
  ] satisfies Partial<ExecutivePushSettings>[])(
    'borra la ultima entrega cuando cambia %j',
    (updates) => {
      updateExecutivePushUseCase(updates, current);
      expect(mocks.executive).toHaveBeenCalledWith(expect.objectContaining({
        executive_push_last_sent_at: null,
        executive_push_last_sent_date: null,
        executive_push_last_sent_slot: null,
      }));
    },
  );

  it('no borra la ultima entrega con bloques iguales ni sin valor anterior', () => {
    updateExecutivePushUseCase({ selectedBlocks: [...current.selectedBlocks], blockOrder: [...current.blockOrder] }, current);
    expect(mocks.executive).toHaveBeenLastCalledWith(expect.not.objectContaining({ executive_push_last_sent_at: null }));
    updateExecutivePushUseCase({ sendTime: '10:00' });
    expect(mocks.executive).toHaveBeenLastCalledWith(expect.not.objectContaining({ executive_push_last_sent_at: null }));
  });
});
