import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ openWhatsApp: vi.fn() }));
vi.mock('@/platform/utils/whatsapp', () => ({ openWhatsApp: mocks.openWhatsApp }));

import { openWhatsAppNow } from './open-whatsapp-now';

const message = (phone: string, text: string) => ({ phone, message: text, title: 'T', description: 'D' });

describe('openWhatsAppNow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens a single message directly and queues nothing', () => {
    const enqueue = vi.fn();
    openWhatsAppNow([message('507', 'uno')], enqueue);
    expect(mocks.openWhatsApp).toHaveBeenCalledWith('507', 'uno');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('opens only the first message (one window per click) and queues the rest', () => {
    const enqueue = vi.fn();
    const messages = [message('507', 'uno'), message('508', 'dos'), message('509', 'tres')];
    openWhatsAppNow(messages, enqueue);
    expect(mocks.openWhatsApp).toHaveBeenCalledTimes(1);
    expect(mocks.openWhatsApp).toHaveBeenCalledWith('507', 'uno');
    expect(enqueue).toHaveBeenCalledWith([messages[1], messages[2]]);
  });

  it('queues everything when the first message has no phone, so the queue offers to copy it', () => {
    const enqueue = vi.fn();
    const messages = [message('', 'uno'), message('508', 'dos')];
    openWhatsAppNow(messages, enqueue);
    expect(mocks.openWhatsApp).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith(messages);
  });

  it('does nothing without messages', () => {
    const enqueue = vi.fn();
    openWhatsAppNow([], enqueue);
    expect(mocks.openWhatsApp).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
});
