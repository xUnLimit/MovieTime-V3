import { describe, expect, it, vi } from 'vitest';
import type { CommerceConversationResult } from './commerce-conversation-use-case';
import { runConversationTurn, type ConversationPorts } from './whatsapp-conversation-use-case';

const answer = (overrides: Partial<CommerceConversationResult> = {}): CommerceConversationResult => (
  { context: { stage: 'buy' }, payload: { kind: 'text', text: 'Catálogo' }, handBack: null, process: 'buy', orderId: null, handoff: false, ...overrides });

function ports(overrides: Partial<ConversationPorts> = {}) {
  const calls: string[] = [];
  const value: ConversationPorts = {
    waiting: vi.fn(async () => 'ignored' as const),
    pauseCommerce: vi.fn(async () => null),
    clearWaiting: vi.fn(async () => undefined),
    commerce: vi.fn(async () => null),
    bot: vi.fn(async () => 'ignored' as const),
    checkpoint: vi.fn(async () => { calls.push('checkpoint'); }),
    send: vi.fn(async () => { calls.push('send'); }),
    ...overrides,
  };
  return { value, calls };
}

describe('runConversationTurn', () => {
  it('gives a pending written answer priority and checkpoints the paused commerce state', async () => {
    const paused = answer({ payload: null, context: { stage: 'buy', paused: true } });
    const { value } = ports({ waiting: vi.fn(async () => 'node' as const), pauseCommerce: vi.fn(async () => paused) });
    await expect(runConversationTurn(value)).resolves.toEqual({ result: 'node', commerce: paused });
    expect(value.commerce).not.toHaveBeenCalled();
    expect(value.bot).not.toHaveBeenCalled();
    expect(value.checkpoint).toHaveBeenCalledWith(paused);
    expect(value.clearWaiting).not.toHaveBeenCalled();
  });

  it('delegates a pending answer that explicitly leads into commerce', async () => {
    const own = answer();
    const { value } = ports({ waiting: vi.fn(async () => ({ delegate: 'buy' as const })), commerce: vi.fn(async () => own) });
    await expect(runConversationTurn(value)).resolves.toEqual({ result: 'commerce', commerce: own });
    expect(value.commerce).toHaveBeenCalledOnce();
    expect(value.commerce).toHaveBeenCalledWith({ command: 'buy' });
    expect(value.clearWaiting).toHaveBeenCalledOnce();
  });

  it('does not let commerce answer when reading a pending answer needs a retry', async () => {
    const { value } = ports({ waiting: vi.fn(async () => 'retry' as const) });
    await expect(runConversationTurn(value)).resolves.toMatchObject({ result: 'retry' });
    expect(value.commerce).not.toHaveBeenCalled();
    expect(value.send).not.toHaveBeenCalled();
  });

  it('answers with the journey when the purchase flow has nothing to say', async () => {
    const { value } = ports({ bot: vi.fn(async () => 'menu' as const) });
    await expect(runConversationTurn(value)).resolves.toEqual({ result: 'menu', commerce: null });
    expect(value.commerce).toHaveBeenCalledTimes(1);
    expect(value.checkpoint).not.toHaveBeenCalled();
  });

  it('saves the purchase state before sending its own answer', async () => {
    const own = answer({ handoff: true });
    const { value, calls } = ports({ commerce: vi.fn(async () => own) });
    await expect(runConversationTurn(value)).resolves.toEqual({ result: 'commerce', commerce: own });
    expect(calls).toEqual(['checkpoint', 'send']);
    expect(value.send).toHaveBeenCalledWith(own.payload);
    expect(value.bot).not.toHaveBeenCalled();
  });

  it('sends nothing for an answer without payload or hand-back', async () => {
    const { value } = ports({ commerce: vi.fn(async () => answer({ payload: null })) });
    await expect(runConversationTurn(value)).resolves.toMatchObject({ result: 'commerce' });
    expect(value.send).not.toHaveBeenCalled();
  });

  it('hands the turn back to the journey after saving the state, without sending a second message', async () => {
    const handBack = { text: 'Listo, cancelé tu selección.', prefixed: true, block: null } as const;
    const own = answer({ payload: null, handBack });
    const { value, calls } = ports({
      commerce: vi.fn(async () => own),
      bot: vi.fn(async () => { calls.push('bot'); return 'menu' as const; }),
    });
    await expect(runConversationTurn(value)).resolves.toEqual({ result: 'menu', commerce: own });
    expect(calls).toEqual(['checkpoint', 'bot']);
    expect(value.bot).toHaveBeenCalledWith({ handBack });
    expect(value.send).not.toHaveBeenCalled();
  });

  it('does not delegate twice when the hand-back lands on a purchase node', async () => {
    const own = answer({ payload: null, handBack: { text: 'Nada que renovar.', prefixed: false, block: null } });
    const { value } = ports({ commerce: vi.fn(async () => own), bot: vi.fn(async () => ({ delegate: 'buy' as const })) });
    await expect(runConversationTurn(value)).resolves.toEqual({ result: 'ignored', commerce: own });
    expect(value.commerce).toHaveBeenCalledTimes(1);
  });

  it('lets the purchase flow answer when the journey reaches a purchase node, passing the notice along', async () => {
    const delegated = answer();
    const commerce = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(delegated);
    const { value, calls } = ports({ commerce, bot: vi.fn(async () => ({ delegate: 'buy' as const, prefix: 'Aviso' })) });
    await expect(runConversationTurn(value)).resolves.toEqual({ result: 'commerce', commerce: delegated });
    expect(commerce).toHaveBeenLastCalledWith({ command: 'buy', prefix: 'Aviso' });
    expect(calls).toEqual(['checkpoint', 'send']);
  });

  it('delegates without a prefix when the journey has none', async () => {
    const commerce = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(answer());
    const { value } = ports({ commerce, bot: vi.fn(async () => ({ delegate: 'summary' as const })) });
    await runConversationTurn(value);
    expect(commerce).toHaveBeenLastCalledWith({ command: 'summary' });
  });

  it('stays silent when a delegation finds the purchase flow unable to answer', async () => {
    const { value } = ports({ bot: vi.fn(async () => ({ delegate: 'buy' as const })) });
    await expect(runConversationTurn(value)).resolves.toEqual({ result: 'ignored', commerce: null });
    expect(value.checkpoint).not.toHaveBeenCalled();
  });
});
