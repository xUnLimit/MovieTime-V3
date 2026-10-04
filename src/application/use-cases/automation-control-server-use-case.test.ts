import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAutomationSettings } from '@/modules/automation-control/contracts';
const mocks = vi.hoisted(() => ({ settings: vi.fn(), interests: vi.fn(), access: vi.fn(), metrics: vi.fn(), rpc: vi.fn(),
  createUserRequestClient: vi.fn(), suggest: vi.fn(), notify: vi.fn() }));
vi.mock('@/modules/automation-control/store', () => ({ createAutomationControlStore: () => mocks }));
vi.mock('@/platform/server/supabase-server', () => ({ createUserRequestClient: mocks.createUserRequestClient }));
vi.mock('./automation-intent-use-case', () => ({ suggestAutomationIntent: mocks.suggest }));
vi.mock('./interest-notification-use-case', () => ({ notifyInterestUseCase: mocks.notify }));
import { executeAutomationControlUseCase, readAutomationControlUseCase } from './automation-control-server-use-case';
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => {
  vi.clearAllMocks(); mocks.settings.mockResolvedValue(defaultAutomationSettings);
  mocks.interests.mockResolvedValue([]); mocks.access.mockResolvedValue([]);
  mocks.metrics.mockResolvedValue({ pendingMessages: 0 });
  mocks.rpc.mockResolvedValue({ data: id, error: null }); mocks.createUserRequestClient.mockReturnValue({ rpc: mocks.rpc });
  mocks.notify.mockResolvedValue(id); mocks.suggest.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());
describe('automation server commands', () => {
  it('returns safe configuration health and only verified capabilities', async () => {
    vi.stubEnv('OPENAI_API_KEY', ''); vi.stubEnv('AUTOMATION_INTEGRATION_TOKEN', '');
    const result = await readAutomationControlUseCase();
    expect(result.settings).toEqual(defaultAutomationSettings);
    expect(result.health).toEqual({ aiConfigured: false, integrationConfigured: false });
    expect(result.providers).toEqual([{ id: 'netflix', name: 'Netflix', loginCode: true, travelCode: true, verified: true }]);
    vi.stubEnv('OPENAI_API_KEY', 'configured'); vi.stubEnv('AUTOMATION_INTEGRATION_TOKEN', 'configured');
    expect((await readAutomationControlUseCase()).health).toEqual({ aiConfigured: true, integrationConfigured: true });
    expect(JSON.stringify(await readAutomationControlUseCase())).not.toContain('configured');
  });
  it('uses the administrator JWT for configuration and account policies', async () => {
    expect(await executeAutomationControlUseCase({ command: 'settings', settings: defaultAutomationSettings }, 'Bearer admin')).toBe(id);
    expect(mocks.createUserRequestClient).toHaveBeenCalledWith('Bearer admin');
    expect(mocks.rpc).toHaveBeenCalledWith('mt_update_automation_settings', { p_settings: defaultAutomationSettings });
    await executeAutomationControlUseCase({ command: 'access', serviceId: id, mode: 'code', rotationConfirmed: true }, 'Bearer admin');
    expect(mocks.rpc).toHaveBeenCalledWith('mt_set_service_access', { p_service_id: id, p_mode: 'code', p_rotation_confirmed: true });
  });
  it('limits interest commands and routes notification through consented delivery', async () => {
    await executeAutomationControlUseCase({ command: 'interest', id, action: 'pause' }, 'Bearer admin');
    expect(mocks.rpc).toHaveBeenCalledWith('mt_manage_interest', { p_id: id, p_action: 'pause' });
    await executeAutomationControlUseCase({ command: 'interest', id, action: 'notify' }, 'Bearer admin');
    expect(mocks.notify).toHaveBeenCalledWith(id);
  });
  it('simulates without financial writes', async () => {
    expect(await executeAutomationControlUseCase({ command: 'simulate', text: 'quiero renovar' }, 'Bearer admin')).toBeNull();
    expect(mocks.suggest).toHaveBeenCalledWith('quiero renovar'); expect(mocks.rpc).not.toHaveBeenCalled();
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
