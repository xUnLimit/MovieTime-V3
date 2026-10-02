import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cases = vi.hoisted(() => ({
  loadNoticeActivityUseCase: vi.fn(), listRecentNoticesUseCase: vi.fn(), fetchTemplatesUseCase: vi.fn(),
  listMetaTemplatesUseCase: vi.fn(), getConfigUseCase: vi.fn(),
}));
vi.mock('@/application/use-cases/automation-use-cases', () => ({
  loadNoticeActivityUseCase: cases.loadNoticeActivityUseCase, listRecentNoticesUseCase: cases.listRecentNoticesUseCase,
}));
vi.mock('@/application/use-cases/templates-use-cases', () => ({ fetchTemplatesUseCase: cases.fetchTemplatesUseCase }));
vi.mock('@/application/use-cases/whatsapp-meta-template-use-cases', () => ({
  listMetaTemplatesUseCase: cases.listMetaTemplatesUseCase, syncMetaTemplatesUseCase: vi.fn(),
}));
vi.mock('@/application/use-cases/config-use-cases', () => ({ getConfigUseCase: cases.getConfigUseCase }));

import { useAutomations } from './use-automations';

const page = { notices: [], total: 25, page: 1, pageSize: 10 };
const config = { whatsapp: { autoEnabled: true, autoSendHour: 9, autoDailyCap: 200 }, notificaciones: { diasAntes: [3], horaEnvio: 9 } };

beforeEach(() => {
  Object.values(cases).forEach((mock) => mock.mockReset());
  cases.loadNoticeActivityUseCase.mockResolvedValue({ dia_pago: { sent: 4, failed: 0, skipped: 1, lastSentAt: 't' } });
  cases.listRecentNoticesUseCase.mockResolvedValue(page);
  cases.fetchTemplatesUseCase.mockResolvedValue([{ id: 't1', tipo: 'dia_pago', contenido: 'Hola', metaTemplateName: null }]);
  cases.listMetaTemplatesUseCase.mockResolvedValue([]);
  cases.getConfigUseCase.mockResolvedValue(config);
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useAutomations(), { wrapper });
}

describe('useAutomations', () => {
  it('builds the grouped catalog with activity, the auto summary and the first notices page', async () => {
    const { result } = setup();
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.recent.data).toEqual(page));
    await waitFor(() => expect(result.current.auto.summary).not.toBeNull());
    const card = result.current.groups.flatMap((group) => group.cards).find((item) => item.tipo === 'dia_pago');
    expect(card?.contenido).toBe('Hola');
    await waitFor(() => expect(result.current.groups[0].cards[0].activity.sent).toBe(4));
    expect(result.current.auto.summary).toEqual({ enabled: true, hour: 9, dailyCap: 200, daysBefore: 3 });
    expect(result.current.error).toBeNull();
    expect(result.current.activityFailed).toBe(false);
  });

  it('reports a Spanish error when templates fail to load', async () => {
    cases.fetchTemplatesUseCase.mockRejectedValue(new Error('sql: relation missing'));
    const { result } = setup();
    await waitFor(() => expect(result.current.error).toBe('No se pudieron cargar las automatizaciones. Intenta de nuevo.'));
    expect(result.current.error).not.toContain('sql');
  });

  it('keeps the catalog when activity, config and notices fail independently', async () => {
    cases.loadNoticeActivityUseCase.mockRejectedValue(new Error('x'));
    cases.getConfigUseCase.mockRejectedValue(new Error('y'));
    cases.listRecentNoticesUseCase.mockRejectedValue(new Error('z'));
    const { result } = setup();
    await waitFor(() => expect(result.current.activityFailed).toBe(true));
    await waitFor(() => expect(result.current.auto.failed).toBe(true));
    await waitFor(() => expect(result.current.recent.error).toBe('No se pudo cargar el historial de envíos. Inténtalo de nuevo.'));
    expect(result.current.error).toBeNull();
    expect(result.current.groups).toHaveLength(4);
    expect(result.current.auto.summary).toBeNull();
  });

  it('shows no anticipation days when the config has none', async () => {
    cases.getConfigUseCase.mockResolvedValue({ ...config, notificaciones: { diasAntes: [], horaEnvio: 9 } });
    const { result } = setup();
    await waitFor(() => expect(result.current.auto.summary?.daysBefore).toBeNull());
  });

  it('applies filters from the first page and pages through the notices', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.recent.data).toEqual(page));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(cases.listRecentNoticesUseCase).toHaveBeenLastCalledWith(2, {}));
    act(() => result.current.setFilters({ tipo: 'despedida', status: 'failed' }));
    await waitFor(() => expect(cases.listRecentNoticesUseCase).toHaveBeenLastCalledWith(1, { tipo: 'despedida', status: 'failed' }));
    expect(result.current.recent.filters).toEqual({ tipo: 'despedida', status: 'failed' });
  });

  it('refresh reloads every source', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.recent.data).not.toBeNull());
    cases.fetchTemplatesUseCase.mockClear();
    await act(async () => { await result.current.refresh(); });
    expect(cases.fetchTemplatesUseCase).toHaveBeenCalledTimes(1);
    expect(cases.getConfigUseCase).toHaveBeenCalled();
  });
});
