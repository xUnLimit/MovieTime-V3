import Link from 'next/link';
import {
  AlertTriangle,
  BellOff,
  BellRing,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  MoreHorizontal,
  PowerOff,
  RefreshCw,
  Star,
  StarOff,
} from 'lucide-react';

import { hideBelowClass } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell, TableRow } from '@/components/ui/table';
import { getCurrencySymbol } from '@/platform/constants';

import {
  formatearFecha,
  getBellIconColor,
  getEstadoBadge,
} from './helpers';
import type {
  CopyToClipboardHandler,
  NotificacionServicioConId,
  ServicioNotificationAction,
  ToggleLeidaHandler,
} from './types';

interface ServiciosProximosTableRowProps {
  notif: NotificacionServicioConId;
  visiblePasswords: ReadonlySet<string>;
  onToggleLeida: ToggleLeidaHandler;
  onCopyToClipboard: CopyToClipboardHandler;
  onTogglePasswordVisibility: (notifId: string) => void;
  onRenovar: ServicioNotificationAction;
  onSeguimiento: ServicioNotificationAction;
  onAcciones: ServicioNotificationAction;
}

export function ServiciosProximosTableRow({
  notif,
  visiblePasswords,
  onToggleLeida,
  onCopyToClipboard,
  onTogglePasswordVisibility,
  onRenovar,
  onSeguimiento,
  onAcciones,
}: ServiciosProximosTableRowProps) {
  const bellColors = getBellIconColor(notif.diasRestantes);
  const estadoBadge = getEstadoBadge(notif.diasRestantes, notif.resaltada);
  const isPasswordVisible = visiblePasswords.has(notif.id);
  const paymentDetail = [
    notif.metodoPagoAlias?.trim(),
    notif.metodoPagoTarjetaTerminacion
      ? `•••• ${notif.metodoPagoTarjetaTerminacion}`
      : '',
  ].filter(Boolean).join(' ');

  return (
    <TableRow
      className={`border-b transition-colors hover:bg-muted/50 ${
        notif.resaltada ? 'bg-warning-subtle' : ''
      }`}
    >
      <TableCell className="text-center">
        <Button
          variant="ghost"
          size="icon"
          className={`mx-auto size-7 rounded-full transition-all duration-200 ease-in-out ${
            notif.resaltada
              ? 'bg-warning-subtle hover:bg-warning/15'
              : notif.leida
                ? 'bg-muted hover:bg-accent'
                : `${bellColors.bgColor} ${bellColors.hoverBgColor}`
          } hover:scale-105`}
          onClick={() => !notif.resaltada && onToggleLeida(notif.id, !notif.leida)}
          title={
            notif.resaltada
              ? 'Notificación en seguimiento'
              : notif.leida
                ? 'Marcar como sin leer'
                : 'Marcar como leída'
          }
        >
          {notif.resaltada ? (
            <AlertTriangle className="h-4 w-4 transition-all duration-200 ease-in-out text-warning" />
          ) : notif.leida ? (
            <BellOff className="h-4 w-4 transition-all duration-200 ease-in-out text-muted-foreground" />
          ) : (
            <BellRing
              className={`h-4 w-4 transition-all duration-200 ease-in-out ${bellColors.textColor}`}
            />
          )}
        </Button>
      </TableCell>

      <TableCell className="text-center">
        <div className="mx-auto max-w-36 leading-tight max-sm:max-w-24" title={notif.servicioNombre || undefined}>
          <p className="truncate font-medium">{notif.categoriaNombre}</p>
          {notif.servicioNombre ? <p className="truncate text-xs text-muted-foreground">{notif.servicioNombre}</p> : null}
        </div>
      </TableCell>

      <TableCell className={`text-center ${hideBelowClass('xl')}`}>
        <div className="flex items-center justify-center gap-2">
            <span className="max-w-36 truncate font-medium">
              {notif.correo}
            </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={() => onCopyToClipboard(notif.correo, 'Email')}
            title="Copiar email"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>

      <TableCell className={`w-32 text-center ${hideBelowClass('2xl')}`}>
        <div className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-1">
          <span className="min-w-0 break-all text-center font-medium leading-tight">
            {isPasswordVisible ? notif.contrasena : '••••••••'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={() => onTogglePasswordVisibility(notif.id)}
            title={
              isPasswordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'
            }
          >
            {isPasswordVisible ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={() => onCopyToClipboard(notif.contrasena, 'Contraseña')}
            title="Copiar contraseña"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>

      <TableCell className={`text-center ${hideBelowClass('2xl')}`}>
        {notif.metodoPagoNombre ? (
          <div className="mx-auto max-w-56 leading-tight">
            <p className="truncate font-medium">{notif.metodoPagoNombre}</p>
            {paymentDetail ? <p className="truncate text-xs text-muted-foreground">{paymentDetail}</p> : null}
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>

      <TableCell className={`text-center ${hideBelowClass('lg')}`}>
        {formatearFecha(new Date(notif.fechaVencimiento))}
      </TableCell>

      <TableCell className={`text-center font-medium whitespace-nowrap ${hideBelowClass('md')}`}>
        <span className="text-success">{getCurrencySymbol(notif.moneda)}</span>
        <span className="text-foreground"> {notif.costoServicio.toFixed(2)}</span>
      </TableCell>

      <TableCell className="text-center">
        <Badge
          variant="outline"
          className={`font-normal gap-1 ${estadoBadge.variant} max-sm:max-w-24 max-sm:whitespace-normal max-sm:text-center`}
        >
          {notif.resaltada && (
            <AlertTriangle className="h-3 w-3 shrink-0" />
          )}
          {estadoBadge.text}
        </Badge>
      </TableCell>

      <TableCell className="text-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`Abrir acciones de ${notif.servicioNombre}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRenovar(notif)}>
              <RefreshCw className="h-4 w-4 mr-2 text-primary" />
              <span className="text-primary">Renovar</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSeguimiento(notif)}>
              {notif.resaltada ? (
                <StarOff className="h-4 w-4 mr-2 text-warning" />
              ) : (
                <Star className="h-4 w-4 mr-2 text-warning" />
              )}
              <span className="text-warning">
                {notif.resaltada ? 'Quitar seguimiento' : 'Seguimiento'}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAcciones(notif)}>
              <PowerOff className="h-4 w-4 mr-2 text-danger" />
              <span className="text-danger">Inactivar</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link prefetch={false} href={`/servicios/detalle/${notif.servicioId}`}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver Servicio
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
