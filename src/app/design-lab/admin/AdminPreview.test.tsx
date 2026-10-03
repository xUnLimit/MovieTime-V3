import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { it, expect, vi } from 'vitest';
vi.mock('next/navigation', () => ({ usePathname: () => '/design-lab/admin' }));
import { AdminPreview } from './AdminPreview';
it('offers synthetic pagination and tab changes without an admin session or remote data', () => {
  const client = new QueryClient(); render(<QueryClientProvider client={client}><AdminPreview /></QueryClientProvider>);
  expect(screen.getByText('Cliente 1')).toBeTruthy(); expect(screen.queryByText('Cliente 11')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /siguiente/i })); expect(screen.getByText('Cliente 11')).toBeTruthy();
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Catálogo' }), { button: 0, ctrlKey: false });
  expect(screen.getByText('Ajustes generales')).toBeTruthy();
});
