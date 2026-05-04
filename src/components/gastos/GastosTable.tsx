'use client';

import { useMemo, useState } from 'react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronDown, Edit, MoreHorizontal, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Column, DataTable } from '@/components/shared/DataTable';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { formatearFecha } from '@/lib/utils/calculations';

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
  const tipoFilterLabel = tipoOptions.find((option) => option.value === tipoFilter)?.label ?? 'Todos los tipos';

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

  const columns: Column<GastoDisplay>[] = [
    {
      key: 'tipoGastoNombre',
      header: 'Tipo',
      sortable: true,
      width: '15%',
      render: (item) => <span className="font-medium">{item.tipoGastoNombre}</span>,
    },
    {
      key: 'detalle',
      header: 'Descripción',
      width: '30%',
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
      width: '20%',
      render: (item) => <span className="font-medium">{formatUSD(item.monto)}</span>,
    },
    {
      key: 'fecha',
      header: 'Fecha',
      sortable: true,
      align: 'center',
      width: '35%',
      render: (item) => formatearFecha(item.fecha),
    },
  ];

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
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="p-4 pb-2">
        <h3 className="text-xl font-semibold">{title}</h3>

        <div className="flex flex-col gap-4 -mb-4 xl:flex-row xl:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por tipo o descripción..."
              className="pl-9"
            />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row xl:flex-none">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal sm:w-[220px]">
                  {tipoFilterLabel}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[220px]">
                {tipoOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setTipoFilter(option.value)}
                    className="flex items-center justify-between"
                  >
                    {option.label}
                    {tipoFilter === option.value && (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between gap-2 text-left font-normal whitespace-nowrap sm:w-[280px]"
                >
                  <span className="flex min-w-0 items-center gap-2 overflow-hidden">
                    <CalendarIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {dateRange?.from ? (
                        dateRange.to ? (
                          `${format(dateRange.from, 'dd MMM yyyy', { locale: es })} - ${format(dateRange.to, 'dd MMM yyyy', { locale: es })}`
                        ) : (
                          format(dateRange.from, 'dd MMM yyyy', { locale: es })
                        )
                      ) : (
                        'Seleccionar rango de fecha'
                      )}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
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
          </div>
        </div>

        <DataTable
          data={filteredGastos as unknown as Record<string, unknown>[]}
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          emptyMessage="No hay gastos registrados"
          pagination
          itemsPerPageOptions={[10, 25, 50]}
          actions={(item) => {
            const gasto = item as unknown as GastoDisplay;
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(gasto)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setGastoToDelete(gasto)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }}
        />
      </Card>

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
