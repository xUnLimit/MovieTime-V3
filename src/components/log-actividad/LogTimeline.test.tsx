import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LogTimeline } from './LogTimeline';

describe('LogTimeline', () => {
  it('usa layout fijo para que los detalles largos no desborden la tabla', () => {
    render(
      <LogTimeline
        logs={[]}
        isLoading={false}
        searchTerm=""
        setSearchTerm={vi.fn()}
        accionFilter="todas"
        setAccionFilter={vi.fn()}
        entidadFilter="todas"
        setEntidadFilter={vi.fn()}
        usuarioFilter="todos"
        setTerceroFilter={vi.fn()}
        hasMore={false}
        hasPrevious={false}
        page={1}
        totalPages={1}
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        onRefresh={vi.fn()}
        onDeleteSelected={vi.fn()}
        onDeleteByDays={vi.fn()}
        onDeleteAll={vi.fn()}
      />,
    );

    expect(screen.getByRole('table').classList.contains('table-fixed')).toBe(true);
  });
});
