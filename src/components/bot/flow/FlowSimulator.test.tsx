import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addConditionNode, connectOption, defaultDefinition } from '@/modules/bot-config';
import type { BotDefinition } from '@/types/bot';
import { FlowSimulator } from './FlowSimulator';

function flow(): BotDefinition {
  let def = addConditionNode(defaultDefinition(), 'customer_has_services');
  const id = def.nodes.at(-1)!.id;
  def = connectOption(connectOption(def, id, 'si', 'netflix'), id, 'no', 'soporte');
  return {
    ...def,
    nodes: def.nodes.map((node) => {
      if (node.id === 'menu') return { ...node, options: [{ id: 'estado', title: 'Mi pedido', next: id }, node.options[1]] };
      return node.id === 'netflix' ? { ...node, body: 'Total {{pedido_total}} ({{pedido_estado}})' } : node;
    }),
  };
}

describe('FlowSimulator con datos de ejemplo', () => {
  it('no muestra datos de ejemplo si el recorrido no usa condiciones ni datos del pedido', () => {
    render(<FlowSimulator def={defaultDefinition()} />);
    expect(screen.queryByText('Datos de ejemplo de la simulación')).toBeNull();
  });

  it('recorre la condicion con los datos de ejemplo y reinicia con los datos editados', async () => {
    const user = userEvent.setup();
    render(<FlowSimulator def={flow()} />);
    await user.click(screen.getByRole('button', { name: 'Iniciar simulación' }));
    await user.click(screen.getByRole('button', { name: 'Mi pedido' }));
    expect(screen.getByText(/Cliente nuevo o existente»: Existente/)).toBeTruthy();
    expect(screen.getByText('Total USD 12.50 (pendiente de pago)')).toBeTruthy();

    await user.click(screen.getByText('Datos de ejemplo de la simulación'));
    await user.click(screen.getByRole('switch', { name: /Cliente nuevo o existente/ }));
    await user.clear(screen.getByLabelText('Total del pedido'));
    await user.type(screen.getByLabelText('Total del pedido'), 'USD 5.00');
    await user.click(screen.getByRole('button', { name: 'Iniciar simulación' }));
    await user.click(screen.getByRole('button', { name: 'Mi pedido' }));
    expect(screen.getByText(/Cliente nuevo o existente»: Nuevo/)).toBeTruthy();
    expect(screen.getByText(/Listo, una persona te atiende/)).toBeTruthy();
  });

  it('un dato vacio muestra el respaldo en la simulacion', async () => {
    const user = userEvent.setup();
    render(<FlowSimulator def={flow()} />);
    await user.click(screen.getByText('Datos de ejemplo de la simulación'));
    await user.clear(screen.getByLabelText('Estado del pago'));
    await user.click(screen.getByRole('button', { name: 'Iniciar simulación' }));
    await user.click(screen.getByRole('button', { name: 'Mi pedido' }));
    expect(screen.getByText('Total USD 12.50 (—)')).toBeTruthy();
  });
});
