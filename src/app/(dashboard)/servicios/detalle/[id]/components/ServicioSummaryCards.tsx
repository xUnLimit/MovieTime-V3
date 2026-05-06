import { DollarSign, Monitor, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { calcularDiasRelativosCalendario, formatearFecha, formatearFechaHora } from '@/lib/utils/calculations';

import type { CategoriaDetalle, MetodoPagoDetalle, ServicioDetalle } from './types';

interface ServicioSummaryCardsProps {
  categoria: CategoriaDetalle | null;
  currencySymbol: string;
  metodoPago: MetodoPagoDetalle | null;
  servicio: ServicioDetalle;
  getCicloPagoLabel: (ciclo: string) => string;
}

export function ServicioSummaryCards({
  categoria,
  currencySymbol,
  getCicloPagoLabel,
  metodoPago,
  servicio,
}: ServicioSummaryCardsProps) {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-32 h-32 flex items-center justify-center">
            <Monitor className="h-16 w-16 text-muted-foreground" />
          </div>

          <div className="w-full space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-sm text-muted-foreground mt-0.5">Categoría</span>
              <span className="text-sm font-medium ml-auto text-right">{categoria?.nombre || 'Sin categoría'}</span>
            </div>
            <div className="flex items-start gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span className="text-sm text-muted-foreground">Costo</span>
              <span className="text-sm font-medium ml-auto text-right">{currencySymbol} {(servicio.costoServicio || 0).toFixed(2)}</span>
            </div>
            <div className="flex items-start gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span className="text-sm text-muted-foreground">Ciclo de Facturación</span>
              <span className="text-sm font-medium ml-auto text-right">{getCicloPagoLabel(servicio.cicloPago ?? '')}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm text-muted-foreground mt-0.5">Fecha de Inicio</span>
              <Badge variant="outline" className="ml-auto font-normal text-sm bg-green-100 text-green-700 border-green-300 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30 [a&]:hover:bg-green-200 dark:[a&]:hover:bg-green-500/30">
                {servicio.fechaInicio ? formatearFecha(new Date(servicio.fechaInicio)) : '-'}
              </Badge>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sm text-muted-foreground mt-0.5">Fecha de Vencimiento</span>
              <Badge variant="outline" className="ml-auto font-normal text-sm bg-green-100 text-green-700 border-green-300 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30 [a&]:hover:bg-green-200 dark:[a&]:hover:bg-green-500/30">
                {servicio.fechaVencimiento ? formatearFecha(new Date(servicio.fechaVencimiento)) : '-'}
              </Badge>
            </div>
            {servicio.fechaVencimiento && (() => {
              const dias = calcularDiasRelativosCalendario(servicio.fechaVencimiento);
              if (dias === null) return null;
              let badgeClass: string;
              let texto: string;
              if (dias < 0) {
                badgeClass = 'border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300';
                texto = `${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''} de retraso`;
              } else if (dias === 0) {
                badgeClass = 'border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300';
                texto = 'Vence hoy';
              } else if (dias <= 7) {
                badgeClass = 'border-yellow-500/50 bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300';
                texto = `${dias} día${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}`;
              } else {
                badgeClass = 'border-green-500/50 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300';
                texto = `${dias} día${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}`;
              }
              return (
                <div className="flex items-start gap-2">
                  <span className="text-sm text-muted-foreground mt-0.5">Días Restantes</span>
                  <Badge variant="outline" className={`ml-auto font-normal text-sm ${badgeClass}`}>
                    {texto}
                  </Badge>
                </div>
              );
            })()}
            <div className="flex items-start gap-2">
              <span className="text-sm text-muted-foreground mt-0.5">Método de Pago</span>
              <span className="text-sm font-medium ml-auto text-right text-purple-600">{metodoPago?.nombre || 'Sin método'}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-0.5">Información Adicional</h2>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Email</p>
            <p className="text-sm font-medium flex items-center gap-2">
              {servicio.correo || 'Sin especificar'}
              {servicio.correo && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    navigator.clipboard.writeText(servicio.correo!);
                    toast.success('Email copiado', { description: 'El email se ha copiado al portapapeles.' });
                  }}
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </Button>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Contraseña</p>
            <p className="text-sm font-medium flex items-center gap-2">
              {servicio.contrasena || 'Sin especificar'}
              {servicio.contrasena && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    navigator.clipboard.writeText(servicio.contrasena!);
                    toast.success('Contraseña copiada', { description: 'La contraseña se ha copiado al portapapeles.' });
                  }}
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </Button>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Creado:</p>
            <p className="text-sm">{formatearFechaHora(new Date(servicio.createdAt))}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Última Actualización:</p>
            <p className="text-sm">{formatearFechaHora(new Date(servicio.updatedAt))}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Notas</h2>
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          {servicio.notas || 'Sin notas'}
        </p>
      </Card>
    </div>
  );
}
