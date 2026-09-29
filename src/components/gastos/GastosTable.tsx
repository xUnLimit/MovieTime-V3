'use client';

import { useMemo, useState } from 'react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Edit, ListFilter, MoreHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { DataTable, defineDataTableColumns } from '@/components/shared/DataTable';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FilterTriggerContent } from '@/components/shared/FilterTriggerContent';
import { TableCard } from '@/components/shared/TableCard';
import { FilterMenu, TableSearch, TableToolbar } from '@/components/shared/TableToolbar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Gasto, TipoGasto } from '@/types';
import { formatearFecha } from '@/platform/utils/calculations';

interface GastoDisplay extends Gasto {
  searchText: string;
}

interface GastosTableProps {
  gastos: Gasto[];
  tiposGasto: TipoGasto[];
  onEdit: (gasto: Gasto) => void;
  onDelete: (id: string) => Promise<void>;
  title?: string;
}

function formatUSD(value: number) {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function GastosTable({
  gastos,
  tiposGasto,
  onEdit,
  onDelete,
  title = 'Todos los gastos',
}: GastosTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [gastoToDelete, setGastoToDelete] = useState<Gasto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const tipoOptions = [
    { value: 'todos', label: 'Todos los tipos' },
    ...tiposGasto.map((tipo) => ({ value: tipo.id, label: tipo.nombre })),
  ];

  const gastosDisplay = useMemo<GastoDisplay[]>(() => (
    gastos.map((gasto) => ({
      ...gasto,
      searchText: `${gasto.tipoGastoNombre} ${gasto.detalle ?? ''}`.toLowerCase(),
    }))
  ), [gastos]);

  const filteredGastos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return gastosDisplay.filter((gasto) => {
      if (query && !gasto.searchText.includes(query)) return false;
      if (tipoFilter !== 'todos' && gasto.tipoGastoId !== tipoFilter) return false;

      if (dateRange?.from && gasto.fecha < dateRange.from) return false;
      if (dateRange?.to) {
        const endOfSelectedDay = new Date(dateRange.to);
        endOfSelectedDay.setHours(23, 59, 59, 999);
        if (gasto.fecha > endOfSelectedDay) return false;
      }

      return true;
    });
  }, [dateRange, gastosDisplay, searchQuery, tipoFilter]);

  const columns = defineDataTableColumns<GastoDisplay>([
    {
      key: 'tipoGastoNombre',
      header: 'Tipo',
      sortable: true,
      render: (item) => <span className="font-medium">{item.tipoGastoNombre}</span>,
    },
    {
      key: 'detalle',
      header: 'Descripción',
      hideBelow: 'sm',
      render: (item) => (
        <span className={item.detalle ? '' : 'text-muted-foreground'}>
          {item.detalle || 'Sin descripción'}
        </span>
      ),
    },
    {
      key: 'monto',
      header: 'Monto',
      sortable: true,
      align: 'center',
      render: (item) => <span className="font-medium">{formatUSD(item.monto)}</span>,
    },
    {
      key: 'fecha',
      header: 'Fecha',
      sortable: true,
      align: 'center',
      render: (item) => formatearFecha(item.fecha),
    },
  ]);

  const handleConfirmDelete = async () => {
    if (!gastoToDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(gastoToDelete.id);
      toast.success('Gasto eliminado', {
        description: 'El gasto fue eliminado correctamente.',
      });
      setGastoToDelete(null);
    } catch (error) {
      toast.error('Error al eliminar gasto', {
        description: getPublicErrorMessage(error, 'No se pudo eliminar el gasto.'),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <TableCard
        title={title}
        toolbar={
          <TableToolbar>
            <TableSearch value={searchQuery} onChange={setSearchQuery} placeholder="Buscar por tipo o descripción..." />
            <FilterMenu icon={ListFilter} ariaLabel="Tipo de gasto" value={tipoFilter} options={tipoOptions} onChange={setTipoFilter} />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between gap-2 text-left font-normal whitespace-nowrap sm:w-64">
                  <FilterTriggerContent
                    icon={CalendarIcon}
                    label={
                      dateRange?.from
                        ? dateRange.to
                          ? `${format(dateRange.from, 'dd MMM yyyy', { locale: es })} - ${format(dateRange.to, 'dd MMM yyyy', { locale: es })}`
                          : format(dateRange.from, 'dd MMM yyyy', { locale: es })
                        : 'Seleccionar rango de fecha'
                    }
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </TableToolbar>
        }
      >
        <DataTable
          bare
          autoPageSize
          data={filteredGastos}
          columns={columns}
          emptyMessage="No hay gastos registrados"
          pagination
          actions={(item) => {
            const gasto = item;
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Acciones del gasto">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(gasto)}>
                    <Edit />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setGastoToDelete(gasto)}
                  >
                    <Trash2 />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }}
        />
      </TableCard>

      <ConfirmDialog
        open={!!gastoToDelete}
        onOpenChange={(open) => {
          if (!open) setGastoToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Eliminar gasto"
        description="Esta acción revertirá el impacto del gasto en el dashboard. ¿Deseas continuar?"
        confirmText="Eliminar"
        variant="danger"
        loading={isDeleting}
      />
    </>
  );
}
