import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addPurchaseFlow, defaultDefinition } from '@/modules/bot-config';
import type { BotAdminApi, BotDefinition } from '@/types/bot';
import { useFlowActions } from './flow-actions';

const copy = vi.hoisted(() => ({ fetchCommerceCopyUseCase: vi.fn() }));
vi.mock('@/application/use-cases/commerce-copy-use-cases', () => copy);
const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

function setup(initial: BotDefinition | null) {
  let draft = initial;
  const updateDraft = vi.fn((change: (current: BotDefinition) => BotDefinition) => { if (draft) draft = change(draft); });
  const select = vi.fn();
  const hook = renderHook(() => useFlowActions({ draft, updateDraft } as unknown as BotAdminApi, select));
  return { actions: () => hook.result.current, current: () => draft, select, updateDraft };
}
beforeEach(() => { copy.fetchCommerceCopyUseCase.mockReset(); toast.error.mockReset(); });

describe('useFlowActions', () => {
  it('delegates node and option edits to the pure model and selects what it creates', () => {
    const view = setup(defaultDefinition());
    act(() => view.actions().addNode('text'));
    expect(view.current()?.nodes.at(-1)?.kind).toBe('text');
    expect(view.select).toHaveBeenCalledWith(view.current()?.nodes.at(-1)?.id);
    act(() => view.actions().moveNode(0, 1));
    act(() => view.actions().updateNode('soporte', { name: 'Persona' }));
    act(() => view.actions().addOption('menu'));
    act(() => view.actions().removeNode('soporte'));
    expect(view.select).toHaveBeenLastCalledWith(null);
  });

  it('sets the entry node through the pure model', () => {
    const view = setup(defaultDefinition());
    act(() => view.actions().setEntry('netflix'));
    expect(view.current()?.entryNodeId).toBe('netflix');
    act(() => view.actions().setEntry('soporte'));
    expect(view.current()?.entryNodeId).toBe('netflix');
  });

  it('does nothing when there is no draft or the node limit is reached', () => {
    const view = setup(null);
    act(() => view.actions().addNode('text'));
    expect(view.updateDraft).not.toHaveBeenCalled();
    const full = { ...defaultDefinition() };
    full.nodes = [...full.nodes, ...Array.from({ length: 40 - full.nodes.length }, (_, i) => ({ id: `extra_${i}`, name: `E${i}`, kind: 'text' as const, body: 'x', options: [] }))];
    const limited = setup(full);
    act(() => limited.actions().addNode('text'));
    expect(limited.updateDraft).not.toHaveBeenCalled();
  });

  it('adds the purchase flow seeded with the texts the bot uses today', async () => {
    copy.fetchCommerceCopyUseCase.mockResolvedValue({ overrides: { greeting: 'Buenas' }, updatedAt: {} });
    const view = setup(defaultDefinition());
    await act(async () => { await view.actions().addPurchaseFlow(); });
    expect(view.current()?.nodes.find((node) => node.id === 'compra_catalogo')?.block?.copy).toEqual({ greeting: 'Buenas' });
    act(() => view.actions().setBlockCopy('compra_catalogo', 'greeting', null));
    expect(view.current()?.nodes.find((node) => node.id === 'compra_catalogo')?.block?.copy).toEqual({});
    act(() => view.actions().removePurchaseFlow());
    expect(view.current()).toEqual(defaultDefinition());
    expect(view.select).toHaveBeenLastCalledWith(null);
  });

  it('keeps the draft unchanged and tells the admin when the current texts cannot be read', async () => {
    copy.fetchCommerceCopyUseCase.mockRejectedValue(new Error('sin red'));
    const view = setup(addPurchaseFlow(defaultDefinition()));
    const before = view.current();
    await act(async () => { await view.actions().addPurchaseFlow(); });
    expect(view.current()).toBe(before);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
