import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAutomationSettings, legacySettingsKeys } from '@/modules/automation-control/contracts';
const mocks = vi.hoisted(() => ({ settings: vi.fn(), interests: vi.fn(), access: vi.fn(), metrics: vi.fn(), rpc: vi.fn(),
  createUserRequestClient: vi.fn(), notify: vi.fn() }));
vi.mock('@/modules/automation-control/store', () => ({ createAutomationControlStore: () => mocks }));
vi.mock('@/platform/server/supabase-server', () => ({ createUserRequestClient: mocks.createUserRequestClient }));
vi.mock('./interest-notification-use-case', () => ({ notifyInterestUseCase: mocks.notify }));
import { executeAutomationControlUseCase, readAutomationControlUseCase } from './automation-control-server-use-case';
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => {
  vi.clearAllMocks(); mocks.settings.mockResolvedValue(defaultAutomationSettings);
  mocks.interests.mockResolvedValue([]); mocks.access.mockResolvedValue([]);
  mocks.metrics.mockResolvedValue({ pendingMessages: 0 });
  mocks.rpc.mockResolvedValue({ data: id, error: null }); mocks.createUserRequestClient.mockReturnValue({ rpc: mocks.rpc });
  mocks.notify.mockResolvedValue(id);
});
afterEach(() => vi.unstubAllEnvs());
describe('automation server commands', () => {
  it('returns safe configuration health and only verified capabilities', async () => {
    vi.stubEnv('AUTOMATION_INTEGRATION_TOKEN', '');
    const result = await readAutomationControlUseCase();
    expect(result.settings).toEqual(defaultAutomationSettings);
    expect(result.health).toEqual({ integrationConfigured: false });
    expect(result.providers).toEqual([{ id: 'netflix', name: 'Netflix', loginCode: true, travelCode: true, verified: true }]);
    vi.stubEnv('AUTOMATION_INTEGRATION_TOKEN', 'configured');
    expect((await readAutomationControlUseCase()).health).toEqual({ integrationConfigured: true });
    expect(JSON.stringify(await readAutomationControlUseCase())).not.toContain('configured');
  });
  it('uses the administrator JWT for configuration and account policies', async () => {
    expect(await executeAutomationControlUseCase({ command: 'settings', settings: defaultAutomationSettings }, 'Bearer admin')).toBe(id);
    expect(mocks.createUserRequestClient).toHaveBeenCalledWith('Bearer admin');
    expect(mocks.rpc).toHaveBeenCalledWith('mt_update_automation_settings', { p_settings: { ...legacySettingsKeys, ...defaultAutomationSettings } });
    expect(legacySettingsKeys).toEqual({ aiMode: 'off', model: '', dailyCalls: 100, dailyTokens: 100000 });
    await executeAutomationControlUseCase({ command: 'access', serviceId: id, mode: 'code', rotationConfirmed: true }, 'Bearer admin');
    expect(mocks.rpc).toHaveBeenCalledWith('mt_set_service_access', { p_service_id: id, p_mode: 'code', p_rotation_confirmed: true });
  });
  it('limits interest commands and routes notification through consented delivery', async () => {
    await executeAutomationControlUseCase({ command: 'interest', id, action: 'pause' }, 'Bearer admin');
    expect(mocks.rpc).toHaveBeenCalledWith('mt_manage_interest', { p_id: id, p_action: 'pause' });
    await executeAutomationControlUseCase({ command: 'interest', id, action: 'notify' }, 'Bearer admin');
    expect(mocks.notify).toHaveBeenCalledWith(id);
  });
  it('rejects invalid IDs and hides SQL errors', async () => {
    await expect(executeAutomationControlUseCase({ command: 'access', serviceId: 'bad', mode: 'code', rotationConfirmed: true }, 'Bearer admin')).rejects.toThrow('UUID');
    await expect(executeAutomationControlUseCase({ command: 'interest', id: 'bad', action: 'pause' }, 'Bearer admin')).rejects.toThrow('UUID');
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'SQL internal detail' } });
    await expect(executeAutomationControlUseCase({ command: 'settings', settings: defaultAutomationSettings }, 'Bearer admin')).rejects.toThrow('No se pudo aplicar el cambio');
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(executeAutomationControlUseCase({ command: 'settings', settings: defaultAutomationSettings }, 'Bearer admin')).rejects.toThrow('id valido');
  });
});
