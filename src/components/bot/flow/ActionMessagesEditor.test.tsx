import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { defaultDefinition, setMessage } from '@/modules/bot-config';
import type { BotMessageKey } from '@/types/bot';
import { ActionMessagesEditor } from './ActionMessagesEditor';

function Harness() {
  const [def, setDef] = useState(defaultDefinition());
  const actions = { setMessage: (key: BotMessageKey, text: string) => setDef(current => setMessage(current, key, text)) };
  return <ActionMessagesEditor action="create_report" def={def} actions={actions} />;
}

it('edits the report confirmation in the draft, previews it, validates and restores it', async () => {
  const user = userEvent.setup(); render(<Harness />);
  const field = screen.getByRole('textbox', { name: 'Texto del mensaje' });
  const original = (field as HTMLTextAreaElement).value;
  await user.clear(field);
  expect(screen.getByRole('alert').textContent).toContain('no puede estar vacío');
  await user.type(field, 'Gracias. Revisaremos tu problema.');
  expect(screen.getByTestId('message-preview').textContent).toContain('Gracias. Revisaremos tu problema.');
  expect(screen.queryByRole('alert')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Restablecer' }));
  expect(field).toHaveProperty('value', original);
});
it('selects each action response and resets the selection when the action changes', async () => {
  const user = userEvent.setup(); const def = defaultDefinition();
  const actions = { setMessage: vi.fn() };
  const view = render(<ActionMessagesEditor action="netflix_travel_code" def={def} actions={actions} />);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Respuesta de la acción' }), 'travel_link_sent');
  expect(screen.getByRole('textbox', { name: 'Texto del mensaje' })).toHaveProperty('value', def.messages.travel_link_sent);
  view.rerender(<ActionMessagesEditor action="handoff" def={def} actions={actions} />);
  expect(screen.getByRole('textbox', { name: 'Texto del mensaje' })).toHaveProperty('value', def.messages.handoff_ack);
  view.rerender(<ActionMessagesEditor action="purchase" def={def} actions={actions} />);
  expect(screen.queryByRole('textbox')).toBeNull();
});
