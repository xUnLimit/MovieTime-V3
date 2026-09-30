import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/auth/LoginScreen', () => ({ LoginScreen: () => <div>pantalla de acceso</div> }));

import LoginPage from './page';

describe('LoginPage', () => {
  it('renders the access screen', () => {
    render(<LoginPage />);
    expect(screen.getByText('pantalla de acceso')).toBeTruthy();
  });
});
