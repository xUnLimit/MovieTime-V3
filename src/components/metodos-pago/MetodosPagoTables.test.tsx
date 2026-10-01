import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ServiciosMetodosPagoTable } from './ServiciosMetodosPagoTable';
import { TercerosMetodosPagoTable } from './TercerosMetodosPagoTable';

describe('tablas de metodos de pago', () => {
  it.each([
    ['Servicios', <ServiciosMetodosPagoTable key="s" metodosPago={[]} />],
    ['Terceros', <TercerosMetodosPagoTable key="t" metodosPago={[]} />],
  ])('%s usa layout fijo para no hacer scroll horizontal', (_name, element) => {
    render(element);

    expect(screen.getByRole('table').classList.contains('table-fixed')).toBe(true);
  });
});
