import { CreditCard, Edit, MoreHorizontal, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getCurrencySymbol } from '@/lib/constants';
import { formatAggregateInUSD, formatearFecha } from '@/lib/utils/calculations';
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
  return (
    <Card className="min-w-0 space-y-4 p-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Historial de Pagos</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Registro completo de todos los pagos realizados para este servicio.
        </p>
      </div>

      <div className="table-scroll-shell">
        <table className="w-full min-w-[1100px]">
          <colgroup>
            <col style={{ width: '12%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
          </colgroup>
          <thead>
            <tr className="border-b text-sm text-muted-foreground">
              <th className="text-left py-3 font-medium whitespace-nowrap">Fecha de Pago</th>
              <th className="text-left py-3 font-medium">Descripción</th>
              <th className="text-left py-3 font-medium whitespace-nowrap">Método de pago</th>
              <th className="text-left py-3 font-medium">Ciclo de facturación</th>
              <th className="text-left py-3 font-medium whitespace-nowrap">Fecha de Inicio</th>
              <th className="text-left py-3 font-medium whitespace-nowrap">Fecha de Vencimiento</th>
              <th className="text-center py-3 font-medium">Monto</th>
              <th className="text-center py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  Cargando historial de pagos...
                </td>
              </tr>
            ) : (
              pagosOrdenados.map((pago, index) => {
                const esInicial = pago.isPagoInicial || pago.descripcion === 'Pago inicial';
                const pagoMetodo = pago.metodoPagoId
                  ? metodosPago.find((m) => m.id === pago.metodoPagoId)
                  : undefined;
                const metodoPagoNombre =
                  pago.metodoPagoNombre?.trim() || pagoMetodo?.nombre || 'Sin método';
                const pagoCurrency = getCurrencySymbol(
                  pago.moneda || pagoMetodo?.moneda || metodoPago?.moneda,
                );
                const esUltimo = index === 0;
                const puedeGestionar = esUltimo && !esInicial;

                return (
                  <tr key={pago.id} className="border-b text-sm">
                    <td className="py-3 whitespace-nowrap">
                      {pago.fecha ? formatearFecha(new Date(pago.fecha)) : '—'}
                    </td>
                    <td className="py-3 font-medium">{pago.descripcion}</td>
                    <td className="py-3 whitespace-nowrap">{metodoPagoNombre}</td>
                    <td className="py-3">{getCicloPagoLabel(pago.cicloPago ?? '') || '—'}</td>
                    <td className="py-3 whitespace-nowrap">
                      {pago.fechaInicio ? formatearFecha(new Date(pago.fechaInicio)) : '—'}
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      {pago.fechaVencimiento ? formatearFecha(new Date(pago.fechaVencimiento)) : '—'}
                    </td>
                    <td className="py-3 text-center font-semibold">
                      {pagoCurrency} {pago.monto.toFixed(2)}
                    </td>
                    <td className="py-3 text-center">
                      {puedeGestionar ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center">
                            <DropdownMenuItem onClick={() => onEditarPago(pago)}>
                              <Edit className="h-3.5 w-3.5 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => onDeleteRenovacion(pago)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <div className="h-7 flex items-center justify-center text-muted-foreground">
                          —
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="pt-3 border-t flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Total Gastado:</span>
        <span className="text-lg font-semibold text-purple-600 dark:text-purple-400">
          {isCalculatingTotal ? (
            <span className="text-xs">Calculando...</span>
          ) : (
            formatAggregateInUSD(totalGastadoUSD)
          )}
        </span>
      </div>
    </Card>
  );
}
