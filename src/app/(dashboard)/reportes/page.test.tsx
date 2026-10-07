import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ admin: true }));
vi.mock('@/store/authStore', () => ({ useAuthStore: (select: (state: unknown) => unknown) => select({ user: { role: mocks.admin ? 'admin' : 'operador' } }) }));
vi.mock('@/components/customer-reports/ReportsView', () => ({ ReportsView: ({ enabled }: { enabled: boolean }) => <p>{enabled ? 'Reports enabled' : 'Reports denied'}</p> }));
import ReportsPage from './page';
it('gates the reports view by role', () => { const { rerender } = render(<ReportsPage />); expect(screen.getByText('Reports enabled')).toBeTruthy(); mocks.admin = false; rerender(<ReportsPage />); expect(screen.getByText('Reports denied')).toBeTruthy(); });
