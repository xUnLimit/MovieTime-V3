import Link from 'next/link';
import {
  AlertTriangle,
  BellOff,
  BellRing,
  Copy,
  Eye,
  EyeOff,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Scissors,
  ShoppingCart,
  Tv2,
  User,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell, TableRow } from '@/components/ui/table';
import { getCurrencySymbol } from '@/lib/constants';

import {
  formatearFecha,
  getBellIconColor,
  getEstadoBadge,
} from './helpers';
import type {
  CopyToClipboardHandler,
  NotificacionVentaConId,
  ToggleLeidaHandler,
  VentaNotificationAction,
} from './types';

interface VentasProximasTableRowProps {
  notif: NotificacionVentaConId;
  visiblePasswords: ReadonlySet<string>;
  onToggleLeida: ToggleLeidaHandler;
  onCopyToClipboard: CopyToClipboardHandler;
  onTogglePasswordVisibility: (notifId: string) => void;
  onNotificar: VentaNotificationAction;
  onCancelar: VentaNotificationAction;
  onAcciones: VentaNotificationAction;
  onRenovar: VentaNotificationAction;
}

export function VentasProximasTableRow({
  notif,
  visiblePasswords,
  onToggleLeida,
  onCopyToClipboard,
  onTogglePasswordVisibility,
  onNotificar,
  onCancelar,
  onAcciones,
  onRenovar,
}: VentasProximasTableRowProps) {
  const bellColors = getBellIconColor(notif.diasRestantes);
  const estadoBadge = getEstadoBadge(notif.diasRestantes, notif.resaltada);
  const isPasswordVisible = visiblePasswords.has(notif.id);

  return (
    <TableRow
      className={`border-b transition-colors hover:bg-muted/50 ${
        notif.resaltada ? 'bg-orange-50/50 dark:bg-orange-500/5' : ''
      }`}
    >
      <TableCell className="px-2 py-2 text-center">
        <Button
          variant="ghost"
          size="icon"
          className={`mx-auto h-8 w-8 rounded-full transition-all duration-200 ease-in-out ${
            notif.resaltada
              ? 'bg-orange-100 dark:bg-orange-500/20 hover:bg-orange-200 dark:hover:bg-orange-500/30'
              : notif.leida
                ? 'bg-gray-100 dark:bg-gray-500/20 hover:bg-gray-200 dark:hover:bg-gray-500/30'
                : `${bellColors.bgColor} ${bellColors.hoverBgColor}`
          } hover:scale-105`}
          onClick={() => !notif.resaltada && onToggleLeida(notif.id, !notif.leida)}
          title={
            notif.resaltada
              ? 'Notificación resaltada (usa Acciones para gestionar)'
              : notif.leida
                ? 'Marcar como sin leer'
                : 'Marcar como leída'
          }
        >
          {notif.resaltada ? (
            <AlertTriangle className="h-4 w-4 transition-all duration-200 ease-in-out text-orange-500" />
          ) : notif.leida ? (
            <BellOff className="h-4 w-4 transition-all duration-200 ease-in-out text-gray-400 dark:text-gray-500" />
          ) : (
            <BellRing
              className={`h-4 w-4 transition-all duration-200 ease-in-out ${bellColors.textColor}`}
            />
          )}
        </Button>
      </TableCell>

      <TableCell className="px-2 py-2 text-center font-medium">
        <span className="inline-block max-w-[130px] truncate align-middle">
          {notif.clienteNombre}
        </span>
      </TableCell>

      <TableCell className="px-2 py-2 text-center">
        <span className="inline-block max-w-[130px] truncate align-middle">
          {notif.categoriaNombre}
        </span>
      </TableCell>

      <TableCell className="px-2 py-2 text-center">
        {notif.servicioCorreo ? (
          <div className="flex items-center justify-center gap-2">
            <span className="max-w-[180px] truncate font-medium">
              {notif.servicioCorreo}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={() => onCopyToClipboard(notif.servicioCorreo!, 'Email')}
              title="Copiar email"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          '-'
        )}
      </TableCell>

      <TableCell className="w-[160px] px-2 py-2 text-center">
        {notif.servicioContrasena ? (
          <div className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-1">
            <span className="min-w-0 break-all text-center font-medium leading-tight">
              {isPasswordVisible ? notif.servicioContrasena : '••••••••'}
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
              onClick={() =>
                onCopyToClipboard(notif.servicioContrasena!, 'Contraseña')
              }
              title="Copiar contraseña"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          '-'
        )}
      </TableCell>

      <TableCell className="px-2 py-2 text-center">
            <span className="inline-block max-w-[100px] truncate font-medium align-middle">
              {notif.perfilNombre || '-'}
            </span>
      </TableCell>

      <TableCell className="px-2 py-2 text-center">
        {notif.codigo ? (
          <div className="flex items-center justify-center gap-2">
            <span className="inline-block max-w-[72px] truncate font-medium align-middle">
              {notif.codigo}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={() => onCopyToClipboard(notif.codigo!, 'Código')}
              title="Copiar código"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          '-'
        )}
      </TableCell>

      <TableCell className="px-2 py-2 text-center">
        {notif.fechaInicio ? formatearFecha(new Date(notif.fechaInicio)) : '—'}
      </TableCell>

      <TableCell className="px-2 py-2 text-center">
        {formatearFecha(new Date(notif.fechaFin))}
      </TableCell>

      <TableCell className="px-2 py-2 text-center">
        {getCurrencySymbol(notif.moneda)}
        {notif.precioFinal?.toFixed(2) || '0.00'}
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
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onNotificar(notif)}>
              <MessageSquare className="h-4 w-4 mr-2 text-green-600" />
              <span className="text-green-600">Notificar</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCancelar(notif)}>
              <XCircle className="h-4 w-4 mr-2 text-red-600" />
              <span className="text-red-600">Cancelar</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAcciones(notif)}>
              <Scissors className="h-4 w-4 mr-2 text-orange-600" />
              <span className="text-orange-600">Cortar</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRenovar(notif)}>
              <RefreshCw className="h-4 w-4 mr-2 text-purple-600" />
              <span className="text-purple-600">Renovar</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link prefetch={false} href={`/usuarios/${notif.clienteId}`}>
                <User className="h-4 w-4 mr-2" />
                Ver Cliente
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link prefetch={false} href={`/ventas/${notif.ventaId}`}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Ver Venta
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link prefetch={false} href={`/servicios/detalle/${notif.servicioId}`}>
                <Tv2 className="h-4 w-4 mr-2" />
                Ver Servicio
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
