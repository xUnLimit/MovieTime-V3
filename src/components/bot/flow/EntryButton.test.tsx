import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { addConditionNode, defaultDefinition } from '@/modules/bot-config';
import type { FlowActions } from './flow-actions';
import { ConditionEditor } from './ConditionEditor';
import { EntryButton } from './EntryButton';

const actions = (): FlowActions => ({ setEntry: vi.fn(), removeNode: vi.fn() } as unknown as FlowActions);
const def = defaultDefinition();
const node = (id: string) => def.nodes.find((item) => item.id === id)!;

describe('Usar como entrada', () => {
  it('llama a setEntry con el nodo y se puede usar con el teclado', async () => {
    const flow = actions();
    render(<EntryButton node={node('soporte')} isEntry={false} actions={flow} />);
    expect(screen.queryByRole('button')).toBeNull();
    render(<EntryButton node={node('netflix')} isEntry={false} actions={flow} />);
    const button = screen.getByRole('button', { name: 'Usar como entrada: Tipo de código de Netflix' });
    button.focus();
    await userEvent.setup().keyboard('{Enter}');
    expect(flow.setEntry).toHaveBeenCalledWith('netflix');
  });

  it('no aparece en la entrada actual', () => {
    render(<EntryButton node={node('menu')} isEntry actions={actions()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ayuda de la condicion', () => {
  const withCondition = addConditionNode(def, 'customer_has_services');
  const condition = withCondition.nodes.at(-1)!;
  const targets = withCondition.nodes.map((item) => ({ id: item.id, name: item.name }));

  it('explica en lenguaje simple y ofrece usarla como entrada', async () => {
    const flow = actions();
    render(<ConditionEditor node={condition} targets={targets} isEntry={false} actions={flow} />);
    expect(screen.getByRole('note').textContent).toContain('Existente = el cliente tiene servicios activos. Nuevo = no los tiene.');
    expect(screen.getByRole('note').textContent).toContain('El cliente no ve este nodo');
    await userEvent.setup().click(screen.getByRole('button', { name: /^Usar como entrada/ }));
    expect(flow.setEntry).toHaveBeenCalledWith(condition.id);
  });

  it('como entrada lo dice y no ofrece el boton; el otro tipo explica cupo', () => {
    const { rerender } = render(<ConditionEditor node={condition} targets={targets} isEntry actions={actions()} />);
    expect(screen.getByRole('note').textContent).toContain('Esta condición es la entrada');
    expect(screen.queryByRole('button', { name: /^Usar como entrada/ })).toBeNull();
    rerender(<ConditionEditor node={{ ...condition, condition: { type: 'catalog_has_stock' } }} targets={targets} isEntry={false} actions={actions()} />);
    expect(screen.getByRole('note').textContent).toContain('Con cupo = hay perfiles libres');
  });
});
