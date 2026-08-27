import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthRecoveryState } from './AuthRecoveryState';

describe('AuthRecoveryState', () => {
  it('explains that the saved session is preserved and allows retrying', () => {
    const onRetry = vi.fn();

    render(
      <AuthRecoveryState
        message="No pudimos validar tu sesión."
        onRetry={onRetry}
      />
    );

    expect(screen.getByText(/tu sesión guardada sigue intacta/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
