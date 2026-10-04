import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FLOW_STEPS, copyKeysOfStep } from '@/modules/commerce-copy/flow';
import { FlowStepCard } from './FlowStepCard';

const step = FLOW_STEPS.find(item => item.id === 'inicio')!;
const setup = (overrides: Record<string, string> = {}, selected = null as 'greeting' | null) => {
  const onSelect = vi.fn(); const onJump = vi.fn();
  render(<FlowStepCard step={step} number={1} keys={copyKeysOfStep('inicio')} overrides={overrides} selected={selected} onSelect={onSelect} onJump={onJump} />);
  return { onSelect, onJump };
};

describe('FlowStepCard', () => {
  it('lista los textos del paso con una vista breve y marca los editados', () => {
    setup({ greeting: 'Buenas, ¿qué necesitas?' });
    const list = screen.getByRole('list', { name: 'Textos del paso Inicio' });
    expect(within(list).getByText('Saludo y menú')).toBeTruthy();
    expect(within(list).getByText('Buenas, ¿qué necesitas?')).toBeTruthy();
    expect(within(list).getAllByText('Editado')).toHaveLength(1);
  });

  it('selecciona un texto y marca el seleccionado', async () => {
    const user = userEvent.setup(); const { onSelect } = setup({}, 'greeting');
    expect(screen.getByRole('button', { name: /Saludo y menú/ }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: /Botón: comprar/ }));
    expect(onSelect).toHaveBeenCalledWith('btnBuy');
  });

  it('permite saltar a los pasos siguientes', async () => {
    const user = userEvent.setup(); const { onJump } = setup();
    await user.click(screen.getByRole('button', { name: /Plataformas/ }));
    expect(onJump).toHaveBeenCalledWith('plataformas');
  });

  it('no muestra siguientes cuando el paso es un final', () => {
    const last = FLOW_STEPS.find(item => item.id === 'ayuda')!;
    render(<FlowStepCard step={last} number={10} keys={copyKeysOfStep('ayuda')} overrides={{}} selected={null} onSelect={vi.fn()} onJump={vi.fn()} />);
    expect(screen.queryByText('Después puede ir a')).toBeNull();
  });
});
