import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ServiceTags } from './ServiceTags';

describe('ServiceTags', () => {
  it('renders nothing for a client without active services', () => {
    const { container } = render(<ServiceTags categories={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows every tag when they fit and names all services for screen readers', () => {
    render(<ServiceTags categories={['Netflix', 'Disney+']} />);
    expect(screen.getByRole('group', { name: 'Servicios activos: Netflix, Disney+' })).toBeTruthy();
    expect(screen.getByText('Netflix')).toBeTruthy();
    expect(screen.getByText('Disney+')).toBeTruthy();
    expect(screen.queryByText(/^\+\d/)).toBeNull();
  });

  it('caps the visible tags and summarizes the rest so a client with many services never fills the row', () => {
    render(<ServiceTags categories={['Canva', 'Crunchyroll', 'Disney+', 'HBO Max', 'Netflix']} />);
    expect(screen.getByText('Canva')).toBeTruthy();
    expect(screen.getByText('Crunchyroll')).toBeTruthy();
    expect(screen.queryByText('Disney+')).toBeNull();
    const more = screen.getByText('+3');
    expect(more.getAttribute('title')).toBe('Disney+, HBO Max, Netflix');
    expect(screen.getByRole('group').getAttribute('aria-label')).toContain('Netflix');
  });

  it('honors a custom limit', () => {
    render(<ServiceTags categories={['A', 'B', 'C', 'D']} max={3} />);
    expect(screen.getByText('C')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
  });
});
