import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tags } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { computeFitRows } from '@/hooks/use-fit-page-size';

import { DataTable, defineDataTableColumns, hideBelowClass } from './DataTable';
import { columnClass, getRowKey, toSortableValue } from './data-table-parts';
import { PaginationFooter } from './PaginationFooter';
import { ServerTableCard } from './ServerTableCard';
import { TableCard } from './TableCard';
import { FilterMenu, TableSearch, TableToolbar } from './TableToolbar';

const fit = vi.hoisted(() => ({ rows: null as number | null }));
vi.mock('@/hooks/use-fit-page-size', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/use-fit-page-size')>()),
  useFitPageSize: () => ({ ref: { current: null }, rows: fit.rows }),
}));

interface Row {
  id: string;
  nombre: string;
  extra: string;
}

const rows: Row[] = [
  { id: '1', nombre: 'Ana', extra: 'uno' },
  { id: '2', nombre: 'Luis', extra: 'dos' },
];

const columns = defineDataTableColumns<Row>([
  { key: 'nombre', header: 'Nombre', sortable: true },
  { key: 'extra', header: 'Extra', hideBelow: 'lg' },
]);

describe('computeFitRows', () => {
  it('calcula cuantas filas caben y respeta minimo y maximo', () => {
    const base = { rowHeight: 40, headerHeight: 40, reserve: 60, minRows: 5, maxRows: 20 };

    expect(computeFitRows({ ...base, available: 500 })).toBe(10);
    expect(computeFitRows({ ...base, available: 100 })).toBe(5);
    expect(computeFitRows({ ...base, available: 5000 })).toBe(20);
  });
});

describe('TableSearch y FilterMenu', () => {
  it('emiten el valor escrito', () => {
    const onChange = vi.fn();
    render(<TableSearch value="" onChange={onChange} placeholder="Buscar..." />);

    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'ana' } });

    expect(onChange).toHaveBeenCalledWith('ana');
  });

  it('muestra la opcion elegida y notifica el cambio', async () => {
    const onChange = vi.fn();
    render(
      <FilterMenu
        icon={Tags}
        ariaLabel="Categoría"
        value="todas"
        options={[
          { value: 'todas', label: 'Todas las categorías' },
          { value: 'netflix', label: 'Netflix' },
        ]}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Categoría' });
    expect(trigger.textContent).toContain('Todas las categorías');

    await userEvent.click(trigger);
    await userEvent.click(await screen.findByText('Netflix'));

    expect(onChange).toHaveBeenCalledWith('netflix');
  });

  it('usa el nombre accesible si el valor no coincide con ninguna opcion', () => {
    render(<FilterMenu icon={Tags} ariaLabel="Categoría" value="x" options={[]} onChange={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Categoría' }).textContent).toContain('Categoría');
  });

  it('TableToolbar coloca las acciones aparte de los filtros', () => {
    render(
      <TableToolbar actions={<button type="button">Notificar</button>}>
        <span>filtros</span>
      </TableToolbar>,
    );

    expect(screen.getByText('filtros')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Notificar' })).toBeTruthy();
  });
});

describe('TableCard', () => {
  it('arma encabezado, filtros, cuerpo y pie', () => {
    const { container } = render(
      <TableCard title="Ventas" description="Detalle" actions={<button type="button">Exportar</button>} toolbar={<span>barra</span>} footer={<span>pie</span>}>
        <p>contenido</p>
      </TableCard>,
    );

    expect(screen.getByRole('heading', { name: 'Ventas' })).toBeTruthy();
    expect(screen.getByText('Detalle')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeTruthy();
    expect(screen.getByText('barra')).toBeTruthy();
    expect(screen.getByText('pie')).toBeTruthy();
    expect(container.querySelector('[data-slot="table-card-body"]')?.textContent).toBe('contenido');
  });

  it('sin encabezado deja solo filtros y cuerpo', () => {
    render(
      <TableCard toolbar={<span>barra</span>}>
        <p>contenido</p>
      </TableCard>,
    );

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('barra')).toBeTruthy();
  });
});

describe('DataTable estandar', () => {
  it('resuelve claves de fila y valores de ordenacion sin IDs validos', () => {
    expect(getRowKey({ nombre: 'Ana' }, 4)).toBe(4);
    expect(getRowKey({ id: 7 }, 4)).toBe(7);
    expect(toSortableValue({ valor: 1 })).toBeNull();
    expect(toSortableValue(true)).toBe(true);
    expect(columnClass({ key: 'monto', header: 'Monto', align: 'right', hideBelow: 'md' }, 0)).toContain('text-right');
    expect(columnClass({ key: 'estado', header: 'Estado', align: 'center' }, 1)).toContain('text-center');
  });
  it('oculta columnas secundarias segun el ancho del contenedor', () => {
    expect(hideBelowClass('lg')).toContain('hidden');
    expect(hideBelowClass('lg')).toContain('table-cell');

    render(<DataTable data={rows} columns={columns} />);

    const extraHeader = screen.getByText('Extra').closest('th');
    expect(extraHeader?.className).toContain(hideBelowClass('lg'));
    expect(screen.getByText('Nombre').closest('th')?.className).not.toContain('hidden');
  });

  it('en modo bare no dibuja borde propio', () => {
    const { container } = render(<DataTable bare data={rows} columns={columns} />);

    expect(container.querySelector('.rounded-lg')).toBeNull();
  });

  it('muestra el estado vacio y el de carga', () => {
    const { rerender } = render(<DataTable data={[]} columns={columns} emptyMessage="Sin datos" />);
    expect(screen.getByText('Sin datos')).toBeTruthy();

    rerender(<DataTable data={rows} columns={columns} loading />);
    expect(screen.getByText('Cargando datos…')).toBeTruthy();
  });

  it('con autoPageSize oculta el selector de filas por pagina', () => {
    fit.rows = 1;
    render(<DataTable bare autoPageSize pagination data={rows} columns={columns} />);

    expect(screen.queryByLabelText('Filas por página')).toBeNull();
    expect(screen.getByText(/Página 1 de/)).toBeTruthy();
    fit.rows = null;
  });

  it('ordena en ambos sentidos y conserva las columnas del layout fijo', async () => {
    const { container } = render(<DataTable fixedLayout data={rows} columns={columns} />);
    expect(container.querySelector('colgroup col')).toBeTruthy();
    const sort = screen.getByRole('button', { name: /Nombre/ });
    await userEvent.click(sort);
    expect(screen.getAllByRole('row')[2].textContent).toContain('Luis');
    await userEvent.click(sort);
    expect(screen.getAllByRole('row')[1].textContent).toContain('Luis');
    await userEvent.click(sort);
    expect(screen.getAllByRole('row')[1].textContent).toContain('Ana');
  });

  it('detiene el click de fila en la celda de acciones', async () => {
    const onRowClick = vi.fn();
    const action = vi.fn();
    render(<DataTable data={rows} columns={columns} onRowClick={onRowClick} actions={() => <button onClick={action}>Abrir</button>} />);
    await userEvent.click(screen.getAllByText('Abrir')[0]);
    expect(action).toHaveBeenCalledOnce();
    expect(onRowClick).not.toHaveBeenCalled();
    await userEvent.click(screen.getByText('Ana'));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });
});

describe('PaginationFooter', () => {
  const props = { page: 2, totalPages: 3, hasPrevious: true, hasMore: true, onPrevious: vi.fn(), onNext: vi.fn() };

  it('muestra el selector solo cuando se pide y cambia el tamano', async () => {
    const onPageSizeChange = vi.fn();
    render(<PaginationFooter {...props} pageSize={10} onPageSizeChange={onPageSizeChange} />);

    await userEvent.click(screen.getByLabelText('Filas por página'));
    await userEvent.click(await screen.findByText('25'));

    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });

  it('sin selector solo deja la navegacion', async () => {
    render(<PaginationFooter {...props} showPageSize={false} />);

    expect(screen.queryByLabelText('Filas por página')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(props.onPrevious).toHaveBeenCalled();
    expect(props.onNext).toHaveBeenCalled();
  });
});

describe('ServerTableCard', () => {
  const pagination = { page: 1, totalPages: 2, hasPrevious: false, hasMore: true, onPrevious: vi.fn(), onNext: vi.fn(), pageSize: 10 };

  it('pinta el pie cuando hay filas y avisa las filas que caben', () => {
    fit.rows = 7;
    const onPageSizeChange = vi.fn();
    render(
      <ServerTableCard title="Terceros" rowCount={3} pagination={{ ...pagination, onPageSizeChange }}>
        <p>tabla</p>
      </ServerTableCard>,
    );

    expect(screen.getByText('Página 1 de 2')).toBeTruthy();
    expect(onPageSizeChange).toHaveBeenCalledWith(7);
    fit.rows = null;
  });

  it('no repite el aviso si el tamano ya coincide y oculta el pie sin filas', () => {
    fit.rows = 10;
    const onPageSizeChange = vi.fn();
    render(
      <ServerTableCard rowCount={0} pagination={{ ...pagination, onPageSizeChange }}>
        <p>vacio</p>
      </ServerTableCard>,
    );

    expect(onPageSizeChange).not.toHaveBeenCalled();
    expect(screen.queryByText('Página 1 de 2')).toBeNull();
    fit.rows = null;
  });
});
