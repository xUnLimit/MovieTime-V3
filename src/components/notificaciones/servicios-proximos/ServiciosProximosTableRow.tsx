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
      <TableCell className="px-2 py-2 text-center">
        <Button
          variant="ghost"
          size="icon"
          className={`mx-auto h-8 w-8 rounded-full transition-all duration-200 ease-in-out ${
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

      <TableCell className="px-2 py-2 text-center">
        <div className="mx-auto flex max-w-[130px] flex-col items-center gap-0.5">
          <span className="w-full truncate font-medium">
            {notif.categoriaNombre}
          </span>
          <span className="w-full truncate text-xs text-muted-foreground">
            {notif.servicioNombre || '-'}
          </span>
        </div>
      </TableCell>

      <TableCell className={`px-2 py-2 text-center ${hideBelowClass('xl')}`}>
        <div className="flex items-center justify-center gap-2">
            <span className="max-w-[180px] truncate font-medium">
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

      <TableCell className={`w-[160px] px-2 py-2 text-center ${hideBelowClass('2xl')}`}>
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

      <TableCell className={`px-2 py-2 text-center ${hideBelowClass('2xl')}`}>
        {notif.metodoPagoNombre ? (
          <div className="flex flex-col items-center justify-center gap-0.5">
            <span className="max-w-[110px] truncate font-medium">
              {notif.metodoPagoNombre}
            </span>
            <span
              className={`max-w-[130px] truncate text-xs leading-tight text-muted-foreground ${
                paymentDetail ? '' : 'invisible'
              }`}
              aria-hidden={!paymentDetail}
            >
              {paymentDetail || '\u00a0'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-0.5">
            <span className="text-muted-foreground">-</span>
            <span className="invisible text-xs leading-tight" aria-hidden>
              {'\u00a0'}
            </span>
          </div>
        )}
      </TableCell>

      <TableCell className={`px-2 py-2 text-center ${hideBelowClass('lg')}`}>
        {formatearFecha(new Date(notif.fechaVencimiento))}
      </TableCell>

      <TableCell className={`px-2 py-2 text-center ${hideBelowClass('md')}`}>
        {getCurrencySymbol(notif.moneda)}
        {notif.costoServicio.toFixed(2)}
      </TableCell>

      <TableCell className="px-2 py-2 text-center">
        <Badge
          variant="outline"
          className={`font-normal gap-1 ${estadoBadge.variant}`}
        >
          {notif.resaltada && (
            <AlertTriangle className="h-3 w-3 shrink-0" />
          )}
          {estadoBadge.text}
        </Badge>
      </TableCell>

      <TableCell className="px-2 py-2 text-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
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
