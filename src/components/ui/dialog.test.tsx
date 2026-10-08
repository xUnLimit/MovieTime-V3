import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Button } from './button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './dialog';

describe('Dialog trigger', () => {
  it('opens through its child and restores focus after Escape', async () => {
    const user = userEvent.setup();
    render(<Dialog>
      <DialogTrigger asChild><Button>Abrir confirmación</Button></DialogTrigger>
      <DialogContent>
        <DialogTitle>Confirmar acción</DialogTitle>
        <DialogDescription>Revisa los datos antes de continuar.</DialogDescription>
        <Button>Continuar</Button>
      </DialogContent>
    </Dialog>);
    const trigger = screen.getByRole('button', { name: 'Abrir confirmación' });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Confirmar acción' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Continuar' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
