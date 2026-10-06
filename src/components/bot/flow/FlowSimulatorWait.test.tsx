import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { addNode, defaultDefinition, setTextAfter, updateNode } from '@/modules/bot-config';
import type { BotDefinition } from '@/types/bot';
import { FlowSimulator } from './FlowSimulator';

/** El menú pregunta: «sí» pasa a una persona, «no» da las gracias y cualquier otra cosa vuelve al menú. */
function asking(): BotDefinition {
  let def = setTextAfter(addNode(defaultDefinition(), 'text', 'Pregunta'), 'pregunta', 'wait');
  def = updateNode(def, 'pregunta', { body: '¿Quieres hablar con una persona?' });
  def = addNode(def, 'text', 'Gracias');
  def = updateNode(def, 'gracias', { body: 'Perfecto, aquí estaré.' });
  return { ...def, nodes: def.nodes.map((node) => {
    if (node.id === 'pregunta') return { ...node, options: [{ id: 'si', title: 'sí, claro', next: 'soporte' }, { id: 'no', title: 'no', next: 'gracias' }, { id: 'otra', title: '', next: 'menu', any: true }] };
    return node;
  }), entryNodeId: 'pregunta' };
}

const phone = () => screen.getByLabelText('Simulación del celular del cliente');

describe('FlowSimulator con un texto que espera la respuesta', () => {
  it('muestra un campo para escribir lo que respondería el cliente solo mientras espera', async () => {
    const user = userEvent.setup();
    render(<FlowSimulator def={asking()} />);
    expect(screen.queryByRole('textbox', { name: 'Respuesta del cliente' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Iniciar simulación' }));
    expect(within(phone()).getByText('¿Quieres hablar con una persona?')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Respuesta del cliente' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar respuesta' })).toHaveProperty('disabled', true);
  });

  it('la respuesta que coincide sigue por su salida y el campo desaparece al terminar', async () => {
    const user = userEvent.setup();
    render(<FlowSimulator def={asking()} />);
    await user.click(screen.getByRole('button', { name: 'Iniciar simulación' }));
    await user.type(screen.getByRole('textbox', { name: 'Respuesta del cliente' }), 'No, gracias');
    await user.click(screen.getByRole('button', { name: 'Enviar respuesta' }));
    expect(within(phone()).getByText('No, gracias')).toBeTruthy();
    expect(within(phone()).getByText('Perfecto, aquí estaré.')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Respuesta del cliente' })).toBeNull();
  });

  it('una respuesta que no coincide cae en «cualquier otra respuesta» y se puede enviar con Enter', async () => {
    const user = userEvent.setup();
    render(<FlowSimulator def={asking()} />);
    await user.click(screen.getByRole('button', { name: 'Iniciar simulación' }));
    await user.type(screen.getByRole('textbox', { name: 'Respuesta del cliente' }), 'quizá mañana{Enter}');
    expect(within(phone()).getByRole('button', { name: 'Código de Netflix' })).toBeTruthy();
  });

  it('reiniciar la simulación borra lo que se había escrito', async () => {
    const user = userEvent.setup();
    const handled = vi.fn();
    render(<FlowSimulator def={asking()} onStep={handled} />);
    await user.click(screen.getByRole('button', { name: 'Iniciar simulación' }));
    await user.type(screen.getByRole('textbox', { name: 'Respuesta del cliente' }), 'sí');
    await user.click(screen.getByRole('button', { name: 'Iniciar simulación' }));
    expect((screen.getByRole('textbox', { name: 'Respuesta del cliente' }) as HTMLInputElement).value).toBe('');
    expect(handled).toHaveBeenLastCalledWith('pregunta');
  });
});
