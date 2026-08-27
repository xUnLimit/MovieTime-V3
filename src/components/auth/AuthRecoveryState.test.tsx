import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthRecoveryState } from './AuthRecoveryState';

describe('AuthRecoveryState', () => {
  it('explains that the saved session is preserved and allows retrying', () => {
    const onRetry = vi.fn();
    const onLogout = vi.fn();

    render(
      <AuthRecoveryState
        message="No pudimos validar tu sesion."
        onRetry={onRetry}
        onLogout={onLogout}
      />
    );

    expect(screen.getByText(/guardada sigue intacta/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
