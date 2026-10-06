import { render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { KeywordsEditor } from './KeywordsEditor';

function Keywords({ initial = ['hola'] }: { initial?: string[] }) {
  const [words, setWords] = useState(initial);
  return <KeywordsEditor keywords={words} onChange={setWords} />;
}

describe('palabras clave', () => {
  it('agrega con Enter, normaliza y acepta varias separadas por comas', async () => {
    const user = userEvent.setup();
    render(<Keywords />);
    await user.type(screen.getByLabelText('Nueva palabra clave'), 'Código, MENÚ{Enter}');
    const list = screen.getByRole('list', { name: 'Palabras clave' });
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['hola', 'codigo', 'menu']);
    expect(screen.getByText('3/30 palabras')).toBeTruthy();
  });

  it('avisa si la palabra ya existe y no la agrega', async () => {
    const user = userEvent.setup();
    render(<Keywords />);
    await user.type(screen.getByLabelText('Nueva palabra clave'), 'HOLA');
    expect(screen.getByRole('alert').textContent).toContain('ya está');
    expect((screen.getByRole('button', { name: 'Agregar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('quita una palabra con su botón y explica el estado vacío', async () => {
    const user = userEvent.setup();
    render(<Keywords />);
    await user.click(screen.getByRole('button', { name: 'Quitar hola' }));
    expect(screen.getByText(/Sin palabras clave/)).toBeTruthy();
  });

  it('respeta el máximo de palabras', () => {
    render(<Keywords initial={Array.from({ length: 30 }, (_, index) => `palabra${index}`)} />);
    expect((screen.getByLabelText('Nueva palabra clave') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/máximo de 30/)).toBeTruthy();
  });
});
