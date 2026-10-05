import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { addPurchaseFlow, defaultDefinition } from '@/modules/bot-config';
import type { BotActionKey } from '@/types/bot';
import type { FlowActions } from './flow-actions';
import { PurchaseActionHint } from './PurchaseActionHint';

const actionsWith = (addPurchaseFlowMock = vi.fn(async () => {})) => ({ addPurchaseFlow: addPurchaseFlowMock }) as unknown as FlowActions;

describe('PurchaseActionHint', () => {
  it.each<BotActionKey>(['purchase', 'renewal', 'my_services'])('explains where the texts of %s are edited and offers the purchase flow when absent', async (action) => {
    const addFlow = vi.fn(async () => {});
    render(<PurchaseActionHint def={defaultDefinition()} action={action} actions={actionsWith(addFlow)} />);
    expect(screen.getByRole('note').textContent).toContain('bloques de compra');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Agregar flujo de compras' }));
    expect(addFlow).toHaveBeenCalledTimes(1);
  });

  it('points to the existing purchase blocks instead of offering to add them again', () => {
    render(<PurchaseActionHint def={addPurchaseFlow(defaultDefinition())} action="purchase" actions={actionsWith()} />);
    expect(screen.getByText(/Selecciona un bloque de compra/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Agregar flujo de compras' })).toBeNull();
  });

  it('does not disturb the actions that have their own text, nor an unset action', () => {
    const { container, rerender } = render(<PurchaseActionHint def={defaultDefinition()} action="handoff" actions={actionsWith()} />);
    expect(container.firstChild).toBeNull();
    rerender(<PurchaseActionHint def={defaultDefinition()} action={undefined} actions={actionsWith()} />);
    expect(container.firstChild).toBeNull();
  });

  it('blocks adding the flow when the diagram has no room for its four blocks', () => {
    const def = defaultDefinition();
    const full = { ...def, nodes: Array.from({ length: 38 }, (_, index) => ({ ...def.nodes[0], id: `n${index}` })) };
    render(<PurchaseActionHint def={full} action="purchase" actions={actionsWith()} />);
    expect(screen.getByRole('button', { name: 'Agregar flujo de compras' })).toHaveProperty('disabled', true);
  });
});
