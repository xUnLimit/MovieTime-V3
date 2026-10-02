import { render, screen } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({ role: 'vendedor' as string | undefined }));
vi.mock('@/store/authStore', () => ({ useAuthStore: (selector: (value: { user: { role: string | undefined } }) => unknown) => selector({ user: { role: state.role } }) }));
vi.mock('@/components/catalog/InterestView', () => ({ InterestView: () => <div>Vista admin</div> }));
import Page from './page';
it('blocks sellers and missing identity and permits administrators', () => {
  const view = render(<Page />); expect(screen.queryByText('Vista admin')).toBeNull();
  state.role = undefined; view.rerender(<Page />); expect(screen.queryByText('Vista admin')).toBeNull();
  state.role = 'admin'; view.rerender(<Page />); expect(screen.getByText('Vista admin')).toBeTruthy();
});
