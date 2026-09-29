'use client';

import { useMemo, useState } from 'react';
import { CalendarRange, CheckCircle2, CreditCard, DollarSign, MoreHorizontal, Plus, Tags, Wallet, XCircle } from 'lucide-react';

import { DataTable, defineDataTableColumns } from '@/components/shared/DataTable';
import { MetricCard } from '@/components/shared/MetricCard';
import { MetricGrid } from '@/components/shared/MetricGrid';
import { Money } from '@/components/shared/Money';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TableCard } from '@/components/shared/TableCard';
import { FilterMenu, TableSearch, TableToolbar, type FilterOption } from '@/components/shared/TableToolbar';
import { getEstadoVencimiento } from '@/components/shared/vencimiento-status';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { ShellPreview } from '../shell/ShellPreview';

interface DemoRow {
  id: string;
  cliente: string;
  servicio: string;
  categoria: string;
  perfil: string;
  monto: number;
  dias: number;
}

const CATEGORIAS = ['Netflix', 'Disney+', 'Max', 'Prime Video', 'Spotify'];
const NOMBRES = ['Ana Rodríguez', 'Luis Pérez', 'María Castillo', 'Carlos Vega', 'Sofía Herrera', 'Emmanuel Del Rosario', 'Keny Jimenez', 'Jordan Flores'];

const ROWS: DemoRow[] = Array.from({ length: 60 }, (_, i) => ({
  id: String(i + 1),
  cliente: NOMBRES[i % NOMBRES.length],
  servicio: `${CATEGORIAS[i % CATEGORIAS.length]} cuenta ${(i % 9) + 1}`,
  categoria: CATEGORIAS[i % CATEGORIAS.length],
  perfil: `Perfil ${(i % 5) + 1}`,
  monto: 4 + (i % 6),
  dias: (i * 7) % 40 - 6,
}));

const CATEGORIA_OPTIONS: readonly FilterOption[] = [{ value: 'todas', label: 'Todas las categorías' }, ...CATEGORIAS.map((c) => ({ value: c, label: c }))];
const ORDEN_OPTIONS: readonly FilterOption[] = [
  { value: 'recientes', label: 'Más recientes' },
  { value: 'actividad', label: 'Última actividad' },
];

const columns = defineDataTableColumns<DemoRow>([
  { key: 'cliente', header: 'Cliente', sortable: true, render: (r) => <span className="font-medium">{r.cliente}</span> },
  { key: 'servicio', header: 'Servicio', sortable: true, hideBelow: 'md', render: (r) => <div className="max-w-64 leading-tight"><p className="truncate font-medium">{r.servicio}</p><p className="truncate text-xs text-muted-foreground">cuenta@movietimepty.top</p></div> },
  { key: 'categoria', header: 'Categoría', hideBelow: 'lg' },
  { key: 'perfil', header: 'Perfil', hideBelow: 'xl' },
  { key: 'monto', header: 'Monto', align: 'right', sortable: true, hideBelow: 'sm', render: (r) => <Money value={r.monto} /> },
  {
    key: 'dias',
    header: 'Estado',
    render: (r) => {
      const estado = getEstadoVencimiento(r.dias);
      return <StatusBadge tone={estado.tone}>{estado.text}</StatusBadge>;
    },
  },
]);

function PreviewPage() {
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('todas');
  const [orden, setOrden] = useState('recientes');

  const data = useMemo(
    () =>
      ROWS.filter((row) => (categoria === 'todas' || row.categoria === categoria) && `${row.cliente} ${row.servicio}`.toLowerCase().includes(search.toLowerCase())),
    [categoria, search]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ventas"
        breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Ventas' }]}
        actions={
          <Button>
            <Plus />
            Nueva Venta
          </Button>
        }
      />
      <MetricGrid>
        <MetricCard title="Ventas Totales" value={218} icon={CreditCard} />
        <MetricCard title="Ingreso Total" value="$17,950.00" icon={DollarSign} />
        <MetricCard title="Ingresos Esperados del Mes" value="$2,340.00" icon={CalendarRange} />
        <MetricCard title="Monto Sin Consumir" value="$1,120.00" icon={Wallet} />
        <MetricCard title="Ventas Activas" value={201} icon={CheckCircle2} tone="success" />
        <MetricCard title="Ventas Inactivas" value={17} icon={XCircle} tone="danger" />
      </MetricGrid>
      <Tabs defaultValue="todas">
        <TabsList>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="activas">Activas</TabsTrigger>
          <TabsTrigger value="inactivas">Inactivas</TabsTrigger>
        </TabsList>
      </Tabs>
      <TableCard
        title="Todas las ventas"
        toolbar={
          <TableToolbar>
            <TableSearch value={search} onChange={setSearch} placeholder="Buscar por cliente o servicio..." />
            <FilterMenu icon={Tags} ariaLabel="Categoría" value={categoria} options={CATEGORIA_OPTIONS} onChange={setCategoria} />
            <FilterMenu icon={CalendarRange} ariaLabel="Orden" value={orden} options={ORDEN_OPTIONS} onChange={setOrden} />
          </TableToolbar>
        }
      >
        <DataTable
          bare
          autoPageSize
          pagination
          data={data}
          columns={columns}
          actions={() => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label="Acciones de la fila">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Ver detalles</DropdownMenuItem>
                <DropdownMenuItem>Editar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />
      </TableCard>
    </div>
  );
}

export function TablesPreview() {
  return (
    <ShellPreview>
      <PreviewPage />
    </ShellPreview>
  );
}
