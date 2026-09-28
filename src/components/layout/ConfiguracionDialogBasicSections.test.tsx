import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DevicePushSection } from './ConfiguracionDialogBasicSections';

describe('DevicePushSection', () => {
  it('lets a subscribed device test push independently of executive reminders', async () => {
    const handleTestPush = vi.fn();
    render(<DevicePushSection
      handlePushSubscriptionToggle={vi.fn()}
      handleTestPush={handleTestPush}
      isPushSupported
      isSendingTestPush={false}
      notificationPermission="granted"
      pushSubscribed
    />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Enviar prueba a este dispositivo' }));

    expect(handleTestPush).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/modo offline|modo sin conexión/i)).toBeNull();
  });

  it('requires an active device subscription before testing', () => {
    render(<DevicePushSection
      handlePushSubscriptionToggle={vi.fn()}
      handleTestPush={vi.fn()}
      isPushSupported
      isSendingTestPush={false}
      notificationPermission="granted"
      pushSubscribed={false}
    />);

    expect(screen.getByRole('button', { name: 'Enviar prueba a este dispositivo' }))
      .toHaveProperty('disabled', true);
  });
});
