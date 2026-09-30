import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ update: vi.fn(), runs: vi.fn() }));
vi.mock('@/platform/supabase/config-repository', () => ({
  getConfig: vi.fn(),
  updateExecutivePushSettings: vi.fn(),
  updateWhatsappAutoSettings: mocks.update,
}));
vi.mock('@/platform/supabase/auto-notice-runs-repository', () => ({ listRecentAutoNoticeRuns: mocks.runs }));

import { listAutoNoticeRunsUseCase, updateWhatsAppAutoUseCase } from './config-use-cases';

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
