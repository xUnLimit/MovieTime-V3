import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentSession = vi.hoisted(() => vi.fn());
const triggerYappySync = vi.hoisted(() => vi.fn());
const resolveYappyPayment = vi.hoisted(() => vi.fn());
const dismissYappyPayment = vi.hoisted(() => vi.fn());
vi.mock('@/platform/supabase/auth', () => ({ getCurrentSession }));
vi.mock('@/platform/supabase/yappy-client', () => ({ triggerYappySync }));
vi.mock('@/platform/supabase/yappy-repository', () => ({
  listYappyPayments: vi.fn(), listYappyConnections: vi.fn(), listYappyCandidateVentas: vi.fn(),
  searchYappyCandidateVentas: vi.fn(),
  resolveYappyPayment, dismissYappyPayment,
}));
import { syncYappyNowUseCase, dismissYappyUseCase, resolveYappyUseCase } from './yappy-use-cases';

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentSession.mockResolvedValue({ access_token: 'session-access' });
  triggerYappySync.mockResolvedValue(undefined);
});

describe('Yappy admin commands', () => {
  it('starts an authenticated manual sync', async () => {
    await syncYappyNowUseCase();
    expect(triggerYappySync).toHaveBeenCalledWith('session-access');
  });
  it('requires a session', async () => {
    getCurrentSession.mockResolvedValueOnce(null);
    await expect(syncYappyNowUseCase()).rejects.toThrow('La sesión expiró');
  });
  it('uses the resolution RPC and requires a dismissal note', async () => {
    await resolveYappyUseCase('payment', 'sale');
    await expect(dismissYappyUseCase('payment', '  ')).rejects.toThrow('Escribe un motivo');
    await dismissYappyUseCase('payment', '  Aviso repetido  ');
    expect(resolveYappyPayment).toHaveBeenCalledWith('payment', 'sale');
    expect(dismissYappyPayment).toHaveBeenCalledWith('payment', 'Aviso repetido');
  });
});
