import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';
import { DropdownMenu, DropdownMenuTrigger } from './dropdown-menu';

describe('Button', () => {
  it('conserva la retroalimentacion de pulsacion en botones normales', () => {
    render(<Button>Guardar</Button>);
    expect(screen.getByRole('button').className).toContain('not-[[aria-haspopup]]:active:scale-[0.98]');
  });

  it('no escala al presionar cuando abre un menu: el menu mediria el boton encogido y saltaria', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Filtro</Button>
        </DropdownMenuTrigger>
      </DropdownMenu>,
    );
    const trigger = screen.getByRole('button');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.className).not.toMatch(/(^|\s)active:scale-/);
  });
});
