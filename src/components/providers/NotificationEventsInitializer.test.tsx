import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  compose: vi.fn(),
  initialize: vi.fn(),
}));

vi.mock('./activity-log-composition', () => {
  mocks.compose();
  return {};
});
vi.mock('@/modules/notifications/notification-event-listeners', () => ({
  initializeNotificationEventListeners: mocks.initialize,
}));

describe('NotificationEventsInitializer', () => {
  it('composes activity logging on import and installs notification listeners once per mount', async () => {
    // Vitest clears mock history before each test; observe the import inside the test.
    const { NotificationEventsInitializer } = await import('./NotificationEventsInitializer');
    expect(mocks.compose).toHaveBeenCalledOnce();
    const view = render(<NotificationEventsInitializer />);
    expect(mocks.initialize).toHaveBeenCalledOnce();
    view.rerender(<NotificationEventsInitializer />);
    expect(mocks.initialize).toHaveBeenCalledOnce();
  });
});
