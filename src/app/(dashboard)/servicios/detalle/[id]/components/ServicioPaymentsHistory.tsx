import { Edit, MoreHorizontal, Trash2 } from 'lucide-react';

import { useMemo } from 'react';

import { DataTable, defineDataTableColumns } from '@/components/shared/DataTable';
import { TableCard } from '@/components/shared/TableCard';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getCurrencySymbol } from '@/platform/constants';
import { formatAggregateInUSD } from '@/modules/payments';
import { formatearFecha } from '@/platform/utils/calculations';
import type { MetodoPago, PagoServicio } from '@/types';

import type { MetodoPagoDetalle, PagoAction } from './types';

interface ServicioPaymentsHistoryProps {
  isCalculatingTotal: boolean;
  isLoading: boolean;
  metodoPago: MetodoPagoDetalle | null;
  metodosPago: MetodoPago[];
  pagosOrdenados: PagoServicio[];
  totalGastadoUSD: number;
  getCicloPagoLabel: (ciclo: string) => string;
  onDeleteRenovacion: PagoAction;
  onEditarPago: PagoAction;
}

export function ServicioPaymentsHistory({
  getCicloPagoLabel,
  isCalculatingTotal,
  isLoading,
  metodoPago,
  metodosPago,
  onDeleteRenovacion,
  onEditarPago,
  pagosOrdenados,
  totalGastadoUSD,
}: ServicioPaymentsHistoryProps) {
  const columns = useMemo(
    () =>
      defineDataTableColumns<PagoServicio>([
        {
          key: 'fecha',
          header: 'Fecha de Pago',
          render: (pago) => (
            <span className="whitespace-nowrap">{pago.fecha ? formatearFecha(new Date(pago.fecha)) : '—'}</span>
          ),
        },
        {
          key: 'descripcion',
          header: 'Descripción',
          render: (pago) => <span className="font-medium">{pago.descripcion}</span>,
        },
        {
          key: 'metodoPagoNombre',
          header: 'Método de pago',
          hideBelow: 'md',
          render: (pago) => {
            const pagoMetodo = pago.metodoPagoId ? metodosPago.find((m) => m.id === pago.metodoPagoId) : undefined;
            return (
              <span className="whitespace-nowrap">
                {pago.metodoPagoNombre?.trim() || pagoMetodo?.nombre || 'Sin método'}
              </span>
            );
          },
        },
        {
          key: 'cicloPago',
          header: 'Ciclo de facturación',
          hideBelow: '2xl',
          render: (pago) => getCicloPagoLabel(pago.cicloPago ?? '') || '—',
        },
        {
          key: 'fechaInicio',
          header: 'Fecha de Inicio',
          hideBelow: 'xl',
          render: (pago) => (
            <span className="whitespace-nowrap">{pago.fechaInicio ? formatearFecha(new Date(pago.fechaInicio)) : '—'}</span>
          ),
        },
        {
          key: 'fechaVencimiento',
          header: 'Fecha de Vencimiento',
          hideBelow: 'xl',
          render: (pago) => (
            <span className="whitespace-nowrap">
              {pago.fechaVencimiento ? formatearFecha(new Date(pago.fechaVencimiento)) : '—'}
            </span>
          ),
        },
        {
          key: 'monto',
          header: 'Monto',
          align: 'center',
          render: (pago) => {
            const pagoMetodo = pago.metodoPagoId ? metodosPago.find((m) => m.id === pago.metodoPagoId) : undefined;
            const pagoCurrency = getCurrencySymbol(pago.moneda || pagoMetodo?.moneda || metodoPago?.moneda);
            return (
              <span className="whitespace-nowrap font-semibold">
                <span className="text-success">{pagoCurrency}</span> {pago.monto.toFixed(2)}
              </span>
            );
          },
        },
      ]),
    [getCicloPagoLabel, metodoPago, metodosPago],
  );

  return (
    <TableCard
      title="Historial de Pagos"
      description="Registro completo de todos los pagos realizados para este servicio."
      footer={
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Gastado:</span>
          <span className="text-base font-semibold text-primary">
            {isCalculatingTotal ? (
              <span className="text-xs">Calculando...</span>
            ) : (
              formatAggregateInUSD(totalGastadoUSD)
            )}
          </span>
        </div>
      }
    >
      <DataTable
        bare
        data={pagosOrdenados}
        columns={columns}
        loading={isLoading}
        emptyMessage="No hay pagos registrados"
        actions={(pago) => {
          const esInicial = pago.isPagoInicial || pago.descripcion === 'Pago inicial';
          return pago === pagosOrdenados[0] && !esInicial ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Acciones del pago">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditarPago(pago)}>
                  <Edit />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => onDeleteRenovacion(pago)}>
                  <Trash2 />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        }}
      />
    </TableCard>
  );
}
