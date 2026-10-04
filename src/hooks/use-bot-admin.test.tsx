import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useCases = vi.hoisted(() => ({
  loadBotAdminSnapshot: vi.fn(), loadBotHealthUseCase: vi.fn(), listBotEventsUseCase: vi.fn(), publishBotUseCase: vi.fn(),
  restoreBotVersionUseCase: vi.fn(), setBotEnabledUseCase: vi.fn(), testBotMailboxUseCase: vi.fn(),
}));
vi.mock('@/application/use-cases/bot-admin-use-cases', () => useCases);
const activityOptions = vi.hoisted(() => ({ logContext: { usuarioId: 'u1', usuarioEmail: 'a@example.test' }, recordActivityLog: vi.fn() }));
vi.mock('@/platform/activity/activity-log-adapter', () => ({ getActivityLogOptions: () => activityOptions }));

import { addConditionNode, addOption, addPurchaseFlow, defaultDefinition, setMessage, updateOption } from '@/modules/bot-config';
import { useBotAdmin } from './use-bot-admin';

const status = { enabled: false, publishedVersion: 1, updatedAt: 't' };
const health = { whatsappConfigured: true, mailboxConfigured: true, lastActivityAt: null, eventsLast24h: 0, codesLast24h: 0, purchaseBlocksEnabled: false, flowExtensionsEnabled: false };
const page = { events: [], total: 0, page: 1, pageSize: 10 };

function mockLoad(published: ReturnType<typeof defaultDefinition> | null = defaultDefinition()) {
  useCases.loadBotAdminSnapshot.mockResolvedValue({ status, published, versions: [{ version: 1, note: 'n', createdAt: 't', createdBy: null, isPublished: true }] });
}

beforeEach(() => {
  Object.values(useCases).forEach((mock) => mock.mockReset());
  mockLoad();
  useCases.loadBotHealthUseCase.mockResolvedValue(health);
  useCases.listBotEventsUseCase.mockResolvedValue(page);
});

async function ready() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => useBotAdmin(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  // Health and activity load in parallel with the snapshot.
  await act(async () => { await Promise.resolve(); });
  return hook;
}

describe('useBotAdmin', () => {
  it('loads status, published definition, versions, health and the first activity page', async () => {
    const { result } = await ready();
    expect(result.current.status).toEqual(status);
    expect(result.current.published).toEqual(defaultDefinition());
    expect(result.current.draft).toEqual(defaultDefinition());
    expect(result.current.versions).toHaveLength(1);
    await waitFor(() => expect(result.current.health).toEqual(health));
    await waitFor(() => expect(result.current.events).toEqual(page));
    expect(result.current.dirty).toBe(false);
    expect(result.current.hasErrors).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('tracks edits: dirty, discard and reset to defaults', async () => {
    const { result } = await ready();
    act(() => result.current.updateDraft((current) => setMessage(current, 'handoff_ack', 'Texto nuevo.')));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.discardDraft());
    expect(result.current.dirty).toBe(false);
    act(() => result.current.updateDraft((current) => setMessage(current, 'handoff_ack', 'Otro.')));
    act(() => result.current.resetToDefaults());
    expect(result.current.draft).toEqual(defaultDefinition());
    expect(result.current.dirty).toBe(false);
  });

  it('recomputes issues and blocks when the draft has errors', async () => {
    const { result } = await ready();
    act(() => result.current.updateDraft((current) => ({ ...current, entryNodeId: 'no_existe' })));
    expect(result.current.hasErrors).toBe(true);
    expect(result.current.issues.some((issue) => issue.severity === 'error')).toBe(true);
  });

  it('starts from the defaults and is dirty when nothing valid is published', async () => {
    mockLoad(null);
    const { result } = await ready();
    expect(result.current.published).toBeNull();
    expect(result.current.draft).toEqual(defaultDefinition());
    expect(result.current.dirty).toBe(true);
  });

  it('ignores draft updates before the draft exists', async () => {
    useCases.loadBotAdminSnapshot.mockRejectedValue(new Error('x'));
    const { result } = await ready();
    act(() => result.current.updateDraft((current) => ({ ...current, keywords: [] })));
    expect(result.current.draft).toBeNull();
    expect(result.current.dirty).toBe(false);
    expect(result.current.issues).toEqual([]);
  });

  it('reports a Spanish load error without raw details and keeps going', async () => {
    useCases.loadBotAdminSnapshot.mockRejectedValue(new Error('sql: relation missing'));
    const { result } = await ready();
    expect(result.current.error).toBe('No se pudo cargar el bot. Intenta de nuevo.');
  });

  it('survives health and activity failures', async () => {
    useCases.loadBotHealthUseCase.mockRejectedValue(new Error('x'));
    useCases.listBotEventsUseCase.mockRejectedValue(new Error('y'));
    const { result } = await ready();
    expect(result.current.health).toBeNull();
    expect(result.current.events).toBeNull();
    expect(result.current.draft).toEqual(defaultDefinition());
  });

  it('publishes the draft with the identity-injected log options and reloads', async () => {
    const { result } = await ready();
    const edited = setMessage(defaultDefinition(), 'handoff_ack', 'Texto nuevo.');
    act(() => result.current.updateDraft(() => edited));
    useCases.publishBotUseCase.mockResolvedValue(2);
    mockLoad(edited);
    await act(async () => { await result.current.publish('Cambio de texto'); });
    expect(useCases.publishBotUseCase).toHaveBeenCalledWith(edited, 'Cambio de texto', activityOptions, defaultDefinition(), false, false);
    expect(result.current.published).toEqual(edited);
    expect(result.current.dirty).toBe(false);
    expect(result.current.saving).toBe(false);
  });

  it('rethrows publish errors for the UI and resets the saving flag', async () => {
    const { result } = await ready();
    useCases.publishBotUseCase.mockRejectedValue(new Error('Escribe una nota que describa el cambio.'));
    await act(async () => {
      await expect(result.current.publish('')).rejects.toThrow('Escribe una nota');
    });
    expect(result.current.saving).toBe(false);
  });

  it('switches the bot and refreshes the status', async () => {
    const { result } = await ready();
    useCases.setBotEnabledUseCase.mockResolvedValue(true);
    useCases.loadBotAdminSnapshot.mockResolvedValue({ status: { ...status, enabled: true }, published: defaultDefinition(), versions: [] });
    await act(async () => { await result.current.setEnabled(true); });
    expect(useCases.setBotEnabledUseCase).toHaveBeenCalledWith(true, activityOptions);
    expect(result.current.status?.enabled).toBe(true);
    useCases.setBotEnabledUseCase.mockRejectedValue(new Error('No tienes permisos.'));
    await act(async () => { await expect(result.current.setEnabled(false)).rejects.toThrow('No tienes permisos.'); });
    expect(result.current.saving).toBe(false);
  });

  it('loads a past version into the draft, pages events and tests the mailbox', async () => {
    const { result } = await ready();
    const old = setMessage(defaultDefinition(), 'handoff_ack', 'Version vieja.');
    useCases.restoreBotVersionUseCase.mockResolvedValue(old);
    await act(async () => { await result.current.loadVersionIntoDraft(1); });
    expect(useCases.restoreBotVersionUseCase).toHaveBeenCalledWith(1, activityOptions);
    expect(result.current.draft).toEqual(old);
    expect(result.current.dirty).toBe(true);

    useCases.listBotEventsUseCase.mockResolvedValue({ ...page, page: 2 });
    await act(async () => { await result.current.loadEvents(2, { type: 'error' }); });
    expect(useCases.listBotEventsUseCase).toHaveBeenLastCalledWith(2, { type: 'error' });
    expect(result.current.events?.page).toBe(2);

    const check = { ok: true, message: 'ok', recentNetflixMails: 3 };
    useCases.testBotMailboxUseCase.mockResolvedValue(check);
    await expect(result.current.testMailbox()).resolves.toEqual(check);
  });

  it('refresh keeps unpublished edits', async () => {
    const { result } = await ready();
    act(() => result.current.updateDraft((current) => setMessage(current, 'handoff_ack', 'Sin publicar.')));
    await act(async () => { await result.current.refresh(); });
    expect(result.current.draft?.messages.handoff_ack).toBe('Sin publicar.');
    expect(result.current.loading).toBe(false);
  });

  it('ignores publish when there is no draft', async () => {
    useCases.loadBotAdminSnapshot.mockRejectedValue(new Error('x'));
    const { result } = await ready();
    await act(async () => { await result.current.publish('Nota'); });
    expect(useCases.publishBotUseCase).not.toHaveBeenCalled();
  });

  it('treats purchase blocks as blocking until the server flag is on, and publishes with the flag it read', async () => {
    let flow = addOption(addPurchaseFlow(defaultDefinition()), 'menu');
    flow = updateOption(flow, 'menu', flow.nodes[0].options.at(-1)!.id, { title: 'Comprar', next: 'compra_catalogo' });
    mockLoad(flow);
    const off = await ready();
    expect(off.result.current.purchaseBlocksEnabled).toBe(false);
    expect(off.result.current.hasErrors).toBe(true);
    off.unmount();
    useCases.loadBotHealthUseCase.mockResolvedValue({ ...health, purchaseBlocksEnabled: true });
    const on = await ready();
    expect(on.result.current.purchaseBlocksEnabled).toBe(true);
    expect(on.result.current.hasErrors).toBe(false);
    act(() => on.result.current.updateDraft((current) => setMessage(current, 'handoff_ack', 'Texto nuevo.')));
    useCases.publishBotUseCase.mockResolvedValue(3);
    await act(async () => { await on.result.current.publish('Con bloques'); });
    expect(useCases.publishBotUseCase).toHaveBeenCalledWith(expect.anything(), 'Con bloques', activityOptions, flow, true, false);
  });

  it('treats conditions as blocking until the flow-extensions flag is on, and publishes with the flag it read', async () => {
    const withCondition = addConditionNode(defaultDefinition(), 'catalog_has_stock');
    mockLoad(withCondition);
    const off = await ready();
    expect(off.result.current.flowExtensionsEnabled).toBe(false);
    expect(off.result.current.hasErrors).toBe(true);
    off.unmount();
    useCases.loadBotHealthUseCase.mockResolvedValue({ ...health, flowExtensionsEnabled: true });
    const on = await ready();
    expect(on.result.current.flowExtensionsEnabled).toBe(true);
    expect(on.result.current.issues.filter((issue) => issue.path.includes('condition'))).toEqual([]);
    act(() => on.result.current.updateDraft((current) => setMessage(current, 'handoff_ack', 'Texto nuevo.')));
    useCases.publishBotUseCase.mockResolvedValue(4);
    await act(async () => { await on.result.current.publish('Con condicion'); });
    expect(useCases.publishBotUseCase).toHaveBeenCalledWith(expect.anything(), 'Con condicion', activityOptions, withCondition, false, true);
  });
});
