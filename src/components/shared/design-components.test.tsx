import { render, screen } from '@testing-library/react';
import { Wallet } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ path: '/ventas' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.path }));

import { MetricCard } from './MetricCard';
import { MetricGrid } from './MetricGrid';
import { Money } from './Money';
import { LoadingSpinner } from './LoadingSpinner';
import { PageHeader } from './PageHeader';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('expone el tono como data attribute y muestra un punto ademas del texto', () => {
    const { container } = render(<StatusBadge tone="danger">Vencida</StatusBadge>);

    const badge = screen.getByText('Vencida');
    expect(badge.getAttribute('data-tone')).toBe('danger');
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('permite ocultar el punto y usa tono neutro por defecto', () => {
    const { container } = render(<StatusBadge dot={false}>Pausado</StatusBadge>);

    expect(screen.getByText('Pausado').getAttribute('data-tone')).toBe('neutral');
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});

describe('Money', () => {
  it('formatea USD con dos decimales', () => {
    render(<Money value={1234.5} />);

    expect(screen.getByText('$1,234.50')).toBeTruthy();
  });

  it('colorea por signo cuando se pide', () => {
    const { rerender } = render(<Money value={10} colorBySign />);
    expect(screen.getByText('$10.00').className).toContain('text-success');

    rerender(<Money value={-10} colorBySign />);
    expect(screen.getByText('-$10.00').className).toContain('text-danger');
  });
});

describe('LoadingSpinner', () => {
  it('se anuncia como estado de carga y admite tamanos', () => {
    const { rerender } = render(<LoadingSpinner />);
    const spinner = screen.getByRole('status', { name: 'Cargando' });
    expect(spinner.getAttribute('class')).toContain('size-6');

    rerender(<LoadingSpinner size="sm" className="extra" />);
    const small = screen.getByRole('status', { name: 'Cargando' });
    expect(small.getAttribute('class')).toContain('size-4');
    expect(small.getAttribute('class')).toContain('extra');
  });
});

describe('PageHeader', () => {
  it('renderiza titulo, descripcion, migas y acciones', () => {
    render(
      <PageHeader
        title="Ventas"
        description="Gestiona suscripciones"
        breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Ventas' }]}
        actions={<button type="button">Nueva venta</button>}
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Ventas' })).toBeTruthy();
    expect(screen.getByText('Gestiona suscripciones')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('href')).toBe('/dashboard');
    expect(screen.getByText('Ventas', { selector: '[aria-current="page"]' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nueva venta' })).toBeTruthy();
  });

  it('calcula la miga estandar desde la ruta: la seccion no enlaza si es la pagina actual', () => {
    nav.path = '/ventas';
    render(<PageHeader title="Ventas" />);

    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('href')).toBe('/dashboard');
    expect(screen.queryByRole('link', { name: 'Ventas' })).toBeNull();
    expect(screen.getByText('Ventas', { selector: '[aria-current="page"]' })).toBeTruthy();
  });

  it('en detalle/crear/editar la seccion enlaza y el elemento actual cierra la miga', () => {
    nav.path = '/ventas/crear';
    render(<PageHeader title="Nueva Venta" trail={[{ label: 'Crear' }]} />);

    expect(screen.getByRole('link', { name: 'Ventas' }).getAttribute('href')).toBe('/ventas');
    expect(screen.getByText('Crear', { selector: '[aria-current="page"]' })).toBeTruthy();
    // "Volver" apunta al padre inmediato de la miga
    expect(screen.getByRole('link', { name: 'Volver' }).getAttribute('href')).toBe('/ventas');
  });

  it('permite volver a otro origen (p. ej. un chat) con backTo y no muestra Volver en paginas de lista', () => {
    nav.path = '/terceros/crear';
    const { unmount } = render(<PageHeader title="Nuevo Tercero" trail={[{ label: 'Crear' }]} backTo="/chats?wa=507" />);
    expect(screen.getByRole('link', { name: 'Volver' }).getAttribute('href')).toBe('/chats?wa=507');
    unmount();

    nav.path = '/terceros';
    render(<PageHeader title="Terceros" />);
    expect(screen.queryByRole('link', { name: 'Volver' })).toBeNull();
  });

  it('no muestra miga en el Dashboard ni en rutas fuera del menu', () => {
    nav.path = '/dashboard';
    const { unmount } = render(<PageHeader title="Dashboard" />);
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
    unmount();

    nav.path = '/ruta-desconocida';
    render(<PageHeader title="Otra" />);
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });
});

describe('MetricCard', () => {
  it('muestra titulo, valor y descripcion', () => {
    render(<MetricCard title="Ingresos" value="$10.00" description="Total" icon={Wallet} tone="success" />);

    expect(screen.getByText('Ingresos')).toBeTruthy();
    expect(screen.getByText('$10.00')).toBeTruthy();
    expect(screen.getByText('Total')).toBeTruthy();
  });

  it('en carga oculta el valor y marca aria-busy', () => {
    const { container } = render(<MetricCard title="Ingresos" value="$10.00" loading />);

    expect(screen.queryByText('$10.00')).toBeNull();
    expect(container.querySelector('[data-slot="metric-card"]')?.getAttribute('aria-busy')).toBe('true');
  });

  it('colorea el valor segun valueTone', () => {
    render(<MetricCard title="Ganancia" value="-$5.00" valueTone="danger" />);

    expect(screen.getByText('-$5.00').className).toContain('text-danger');
  });

  it('muestra la tendencia con el tono segun su signo', () => {
    const { rerender } = render(<MetricCard title="Ventas" value="10" trend={{ value: 12, isPositive: true }} />);
    expect(screen.getByText('12%').className).toContain('text-success');

    rerender(<MetricCard title="Ventas" value="10" trend={{ value: -5, isPositive: false }} />);
    expect(screen.getByText('5%').className).toContain('text-danger');
  });

  it('en carga con descripcion mantiene la forma sin mostrar el texto', () => {
    render(<MetricCard title="Ingresos" value="$1" description="Detalle" icon={Wallet} loading />);

    expect(screen.queryByText('Detalle')).toBeNull();
    expect(screen.queryByText('Ingresos')).toBeNull();
  });

  it('dentro de una franja se renderiza plano (sin borde propio completo)', () => {
    const { container } = render(
      <MetricGrid variant="strip">
        <MetricCard title="A" value="1" />
        <MetricCard title="B" value="2" />
      </MetricGrid>
    );

    expect(container.querySelector('[data-slot="metric-grid"]')?.getAttribute('data-variant')).toBe('strip');
    expect(container.querySelector('[data-slot="metric-card"]')?.className).toContain('border-0');
  });
});
