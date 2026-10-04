import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAutomationSettings } from '@/modules/automation-control/contracts';
const mocks = vi.hoisted(() => ({ session: vi.fn(), get: vi.fn(), post: vi.fn(), online: vi.fn() }));
vi.mock('@/platform/supabase/auth', () => ({ getCurrentSession: mocks.session }));
vi.mock('@/platform/api/automation-control-client', () => ({ getAutomationControl: mocks.get, postAutomationControl: mocks.post }));
vi.mock('@/platform/utils/online-mutation', () => ({ assertOnlineMutation: mocks.online }));
import { fetchAutomationControlUseCase, simulateAutomationIntentUseCase, updateAutomationSettingsUseCase,
  updateInterestUseCase, updateServiceAccessUseCase } from './automation-control-use-cases';
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ access_token: 'session' }); mocks.get.mockResolvedValue('snapshot'); mocks.post.mockResolvedValue('result'); mocks.online.mockReturnValue(undefined); });
describe('automation browser use cases', () => {
  it('injects session identity without accepting caller credentials', async () => {
    expect(await fetchAutomationControlUseCase()).toBe('snapshot'); expect(mocks.get).toHaveBeenCalledWith('session');
    await updateAutomationSettingsUseCase(defaultAutomationSettings);
    expect(mocks.post).toHaveBeenLastCalledWith('session', { command: 'settings', settings: defaultAutomationSettings });
    await updateServiceAccessUseCase({ serviceId: 'id', mode: 'code', rotationConfirmed: true });
    expect(mocks.post).toHaveBeenLastCalledWith('session', { command: 'access', serviceId: 'id', mode: 'code', rotationConfirmed: true });
    await updateInterestUseCase({ id: 'interest', action: 'pause' });
    expect(mocks.post).toHaveBeenLastCalledWith('session', { command: 'interest', id: 'interest', action: 'pause' });
    await simulateAutomationIntentUseCase('hello'); expect(mocks.post).toHaveBeenLastCalledWith('session', { command: 'simulate', text: 'hello' });
  });
  it('rejects anonymous reads and offline mutations before sending', async () => {
    mocks.session.mockResolvedValue(null);
    await expect(fetchAutomationControlUseCase()).rejects.toThrow('Inicia sesión');
    await expect(updateInterestUseCase({ id: 'interest', action: 'notify' })).rejects.toThrow('Inicia sesión');
    expect(mocks.post).not.toHaveBeenCalled();
    mocks.session.mockResolvedValue({ access_token: 'session' }); mocks.online.mockImplementation(() => { throw new Error('Sin conexión'); });
    await expect(updateAutomationSettingsUseCase(defaultAutomationSettings)).rejects.toThrow('Sin conexión');
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
