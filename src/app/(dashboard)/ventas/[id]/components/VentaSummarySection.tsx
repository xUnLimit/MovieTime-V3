import Link from 'next/link';
import { Calendar, User } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatearFecha } from '@/lib/utils/calculations';
import type { VentaDoc } from '@/types';

import type { VentaEstadoDetalle } from './types';

const getCicloPagoLabel = (ciclo?: string) => {
  const labels: Record<string, string> = {
    mensual: 'Mensual',
    trimestral: 'Trimestral',
    semestral: 'Semestral',
    anual: 'Anual',
  };
  return ciclo ? labels[ciclo] || ciclo : '—';
};

const getDiasRestantesLabel = (diasRestantes: number) => {
  if (diasRestantes < 0) {
    return `${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) !== 1 ? 's' : ''} de retraso`;
  }

  if (diasRestantes === 0) {
    return 'Vence hoy';
  }

  return `${diasRestantes} día${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''}`;
};

const getDiasRestantesClass = (diasRestantes: number) => {
  if (diasRestantes <= 0) {
    return 'border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300';
  }

  if (diasRestantes <= 7) {
    return 'border-yellow-500/50 bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300';
  }

  return 'border-green-500/50 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300';
};

interface VentaSummarySectionProps extends VentaEstadoDetalle {
  diasRestantes: number;
  perfilDisplay: string;
  renovaciones: number;
  servicioContrasena: string;
  venta: VentaDoc;
}

export function VentaSummarySection({
  diasRestantes,
  esCortada,
  estadoBadgeClass,
  estadoLabel,
  perfilDisplay,
  renovaciones,
  servicioContrasena,
  venta,
}: VentaSummarySectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(320px,1fr)]">
      <Card className="min-w-0 p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Información General</h2>
            <p className="text-sm text-muted-foreground">
              Resumen de la suscripción del servicio {venta.servicioNombre}.
            </p>
          </div>
          <Badge className={estadoBadgeClass}>{estadoLabel}</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 md:gap-x-8">
          <div>
            <p className="text-xs text-muted-foreground">Cliente</p>
            {venta.clienteId ? (
              <Link prefetch={false} href={`/terceros/${venta.clienteId}`} className="text-sm font-medium text-purple-500 hover:underline">
                {venta.clienteNombre}
              </Link>
            ) : (
              <p className="text-sm font-medium">{venta.clienteNombre}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Método de Pago</p>
            <p className="text-sm font-medium text-purple-500">{venta.metodoPagoNombre || 'Sin método'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ciclo de pago</p>
            <p className="text-sm font-medium">{getCicloPagoLabel(venta.cicloPago)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Categoría</p>
            <p className="text-sm font-medium">{venta.categoriaNombre || 'Sin categoría'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Servicio</p>
            <p className="text-sm font-medium">{venta.servicioCorreo || venta.servicioNombre}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Contraseña</p>
            <p className="text-sm font-medium">{servicioContrasena || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Perfil</p>
            <p className="text-sm font-medium text-green-600 dark:text-green-400">{perfilDisplay}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Código</p>
            <p className="text-sm font-medium">{venta.codigo || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Renovaciones</p>
            <p className="text-sm font-medium">{renovaciones}</p>
          </div>
        </div>

        <div className="border-t pt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 md:gap-x-8">
          <div>
            <p className="text-xs text-muted-foreground">Fecha de Inicio</p>
            <p className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {venta.fechaInicio ? formatearFecha(new Date(venta.fechaInicio)) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Fecha de Vencimiento</p>
            <p className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {venta.fechaFin ? formatearFecha(new Date(venta.fechaFin)) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Días Restantes</p>
            {esCortada ? (
              <Badge variant="outline" className="mt-1 font-normal border-orange-500/50 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
                Servicio cortado
              </Badge>
            ) : venta.estado === 'inactivo' ? (
              <span className="mt-1 block text-sm text-muted-foreground">—</span>
            ) : (
              <Badge variant="outline" className={`mt-1 font-normal ${getDiasRestantesClass(diasRestantes)}`}>
                {getDiasRestantesLabel(diasRestantes)}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      <Card className="min-w-0 p-6 space-y-5">
        <div className="flex flex-col items-center text-center gap-3">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              venta.estado === 'inactivo' ? 'bg-red-500/20' : 'bg-green-500/20'
            }`}
          >
            <User className={`h-7 w-7 ${venta.estado === 'inactivo' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              {venta.estado === 'inactivo' ? 'Perfil sin Asignar' : 'Perfil Asignado'}
            </h3>
            <p className="text-sm text-muted-foreground">Información del servicio en uso</p>
          </div>
          <p className={`text-sm font-medium ${venta.estado === 'inactivo' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {venta.estado === 'inactivo' ? 'No asignado' : (venta.servicioCorreo || venta.servicioNombre)}
          </p>
          <p className="text-xs text-muted-foreground">
            {venta.estado === 'inactivo' ? 'El perfil ha sido inactivado' : 'Perfil asignado correctamente'}
          </p>
        </div>

        <div className="border-t pt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Servicio:</span>
            <span className="font-medium">{venta.servicioCorreo || venta.servicioNombre}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Perfil:</span>
            <span className="font-medium">{venta.perfilNumero ? `Perfil ${venta.perfilNumero}` : '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Asignado a:</span>
            <span className="font-medium">{venta.clienteNombre}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Estado:</span>
            <Badge className={estadoBadgeClass}>{estadoLabel}</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
