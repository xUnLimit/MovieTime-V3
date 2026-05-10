import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DollarSign, Pencil, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getCurrencySymbol } from '@/lib/constants';
import { formatAggregateInUSD } from '@/lib/utils/calculations';
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
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <DollarSign className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Historial de pagos del servicio</h2>
      </div>

      <div className="table-scroll-shell">
        <table className="w-full min-w-[960px]">
          <thead>
            <tr className="border-b text-sm text-muted-foreground">
              <th className="text-left py-3 font-medium whitespace-nowrap">Fecha</th>
              <th className="text-left py-3 font-medium whitespace-nowrap">Descripción</th>
              <th className="text-left py-3 font-medium whitespace-nowrap">Método de pago</th>
              <th className="text-left py-3 font-medium whitespace-nowrap">Ciclo de facturación</th>
              <th className="text-left py-3 font-medium whitespace-nowrap">Fecha de Inicio</th>
              <th className="text-left py-3 font-medium whitespace-nowrap">Fecha de Vencimiento</th>
              <th className="text-left py-3 font-medium whitespace-nowrap">Monto</th>
              <th className="text-center py-3 font-medium whitespace-nowrap">Acciones</th>
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
              <>
                {pagosOrdenados.map((pago) => {
                  const esInicial = pago.isPagoInicial || pago.descripcion === 'Pago inicial';
                  const pagoMetodo = pago.metodoPagoId
                    ? metodosPago.find((m) => m.id === pago.metodoPagoId)
                    : undefined;
                  const metodoPagoNombre =
                    pago.metodoPagoNombre?.trim() || pagoMetodo?.nombre || 'Sin método';
                  const pagoCurrency = getCurrencySymbol(pago.moneda || pagoMetodo?.moneda || metodoPago?.moneda);
                  return (
                    <tr key={pago.id} className="border-b text-sm">
                      <td className="py-3">
                        {format(new Date(pago.fecha), 'd MMM yyyy', { locale: es })}
                      </td>
                      <td className="py-3">{pago.descripcion}</td>
                      <td className="py-3 whitespace-nowrap">{metodoPagoNombre}</td>
                      <td className="py-3">
                        {getCicloPagoLabel(pago.cicloPago ?? '') || '-'}
                      </td>
                      <td className="py-3">
                        {format(new Date(pago.fechaInicio), 'd MMM yyyy', { locale: es })}
                      </td>
                      <td className="py-3">
                        {format(new Date(pago.fechaVencimiento), 'd MMM yyyy', { locale: es })}
                      </td>
                      <td className="py-3 text-left">
                        {pagoCurrency} {pago.monto.toFixed(2)}
                      </td>
                      <td className="py-3 text-center">
                        {pago.id === pagosOrdenados[0]?.id && !esInicial ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <span className="text-lg">...</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center">
                              <DropdownMenuItem onClick={() => onEditarPago(pago)}>
                                <Pencil className="h-3.5 w-3.5 mr-2" />
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
                          <div className="h-8 flex items-center justify-center text-muted-foreground">-</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-4 border-t -mx-6 px-6">
        <div className="flex justify-end items-center mt-2">
          <span className="text-sm text-muted-foreground mr-2">Total Gastado:</span>
          <span className="text-lg font-semibold text-purple-600">
            {isCalculatingTotal ? (
              <span className="text-xs">Calculando...</span>
            ) : (
              formatAggregateInUSD(totalGastadoUSD)
            )}
          </span>
        </div>
      </div>
    </Card>
  );
}
