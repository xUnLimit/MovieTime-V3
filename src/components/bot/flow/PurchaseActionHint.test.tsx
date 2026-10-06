import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BotActionKey } from '@/types/bot';
import { PurchaseActionHint } from './PurchaseActionHint';

describe('PurchaseActionHint', () => {
  it.each<BotActionKey>(['purchase', 'renewal', 'my_services'])('explains where the texts of %s are edited and opens the purchase flow without adding anything first', async (action) => {
    const open = vi.fn();
    render(<PurchaseActionHint action={action} onOpenPurchase={open} />);
    expect(screen.getByRole('note').textContent).toContain('flujo de compra');
    expect(screen.queryByRole('button', { name: 'Agregar flujo de compras' })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Editar textos de compra' }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('only explains when there is no way to open the flow', () => {
    render(<PurchaseActionHint action="purchase" />);
    expect(screen.getByRole('note')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not disturb the actions that have their own text, nor an unset action', () => {
    const { container, rerender } = render(<PurchaseActionHint action="handoff" />);
    expect(container.firstChild).toBeNull();
    rerender(<PurchaseActionHint action={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});
