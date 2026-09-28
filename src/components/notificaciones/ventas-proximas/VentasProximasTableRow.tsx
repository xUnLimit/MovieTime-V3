import {
  AlertTriangle,
  BellOff,
  BellRing,
  CalendarClock,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { VentaNoticeState } from '@/application/use-cases/whatsapp-notices-use-cases';
import { TableCell, TableRow } from '@/components/ui/table';
import { getCurrencySymbol } from '@/platform/constants';
import { getPaymentPromiseDisplay } from '@/application/use-cases/notificaciones/payment-promise';

import {
  formatearFecha,
  getBellIconColor,
  getEstadoBadge,
} from './helpers';
import { noticeBadgeInfo } from './notice-helpers';
import { VentasProximasActionsMenu } from './VentasProximasActionsMenu';
import type {
  CopyToClipboardHandler,
  NotificacionVentaConId,
  ToggleLeidaHandler,
  VentaNotificationAction,
} from './types';

interface VentasProximasTableRowProps {
  notif: NotificacionVentaConId;
  renovaciones?: number;
  renovacionesError?: boolean;
  noticeState?: VentaNoticeState;
  selected?: boolean;
  onSelectedChange?: (notifId: string, selected: boolean) => void;
  visiblePasswords: ReadonlySet<string>;
  onToggleLeida: ToggleLeidaHandler;
  onCopyToClipboard: CopyToClipboardHandler;
  onTogglePasswordVisibility: (notifId: string) => void;
  onNotificar: VentaNotificationAction;
  onAcciones: VentaNotificationAction;
  onRenovar: VentaNotificationAction;
  onPaymentPromise: VentaNotificationAction;
  onSeguimiento: VentaNotificationAction;
}

export function VentasProximasTableRow({
  notif,
  renovaciones,
  renovacionesError,
  noticeState,
  selected = false,
  onSelectedChange,
  visiblePasswords,
  onToggleLeida,
  onCopyToClipboard,
  onTogglePasswordVisibility,
  onNotificar,
  onAcciones,
  onRenovar,
  onPaymentPromise,
  onSeguimiento,
}: VentasProximasTableRowProps) {
  const bellColors = getBellIconColor(notif.diasRestantes);
  const estadoBadge = getEstadoBadge(notif.diasRestantes, notif.resaltada);
  const noticeBadge = noticeBadgeInfo(noticeState);
  const isPasswordVisible = visiblePasswords.has(notif.id);
  const promiseDisplay = notif.fechaPrometidaPago
    ? getPaymentPromiseDisplay(notif.fechaPrometidaPago)
    : null;
  const promiseOverdue = promiseDisplay?.state === 'overdue';
  const rowToneClass = notif.resaltada
    ? 'bg-orange-50/50 dark:bg-orange-500/5'
    : promiseDisplay
      ? promiseOverdue
        ? 'bg-red-50/70 dark:bg-red-500/10'
        : 'bg-blue-50/70 dark:bg-blue-500/10'
      : '';
  const displayedStatus = promiseDisplay
    ? {
        text: promiseDisplay.text,
        variant: promiseOverdue
          ? 'border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
          : 'border-blue-500/50 bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
      }
    : estadoBadge;

  return (
    <TableRow className={`border-b transition-colors hover:bg-muted/50 ${rowToneClass}`}>
      {onSelectedChange ? (
        <TableCell className="w-[40px] px-2 py-2 text-center">
          <Checkbox
            checked={selected}
            onCheckedChange={(value) => onSelectedChange(notif.id, value === true)}
            aria-label={`Seleccionar ${notif.clienteNombre}`}
          />
        </TableCell>
      ) : null}
      <TableCell className="px-2 py-2 text-center">
        <Button
          variant="ghost"
          size="icon"
          className={`mx-auto h-8 w-8 rounded-full transition-all duration-200 ease-in-out ${
            promiseDisplay
              ? promiseOverdue
                ? 'bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30'
                : 'bg-blue-100 dark:bg-blue-500/20 hover:bg-blue-200 dark:hover:bg-blue-500/30'
              : notif.resaltada
              ? 'bg-orange-100 dark:bg-orange-500/20 hover:bg-orange-200 dark:hover:bg-orange-500/30'
              : notif.leida
                ? 'bg-gray-100 dark:bg-gray-500/20 hover:bg-gray-200 dark:hover:bg-gray-500/30'
                : `${bellColors.bgColor} ${bellColors.hoverBgColor}`
          } hover:scale-105`}
          onClick={() => !promiseDisplay && !notif.resaltada && onToggleLeida(notif.id, !notif.leida)}
          title={
            promiseDisplay
              ? promiseDisplay.text
              : notif.resaltada
              ? 'Notificación en seguimiento'
              : notif.leida
                ? 'Marcar como sin leer'
                : 'Marcar como leída'
          }
        >
          {promiseDisplay ? (
            <CalendarClock
              className={`h-4 w-4 transition-all duration-200 ease-in-out ${
                promiseOverdue ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'
              }`}
            />
          ) : notif.resaltada ? (
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
        <div className="mx-auto flex max-w-[130px] flex-col items-center gap-0.5">
          <span className="w-full truncate font-medium">
            {notif.categoriaNombre}
          </span>
          <span className="w-full truncate text-xs text-muted-foreground">
            {notif.servicioNombre || '-'}
          </span>
        </div>
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

      <TableCell
        className="px-2 py-2 text-center tabular-nums"
        title={renovacionesError ? 'No se pudieron cargar las renovaciones' : 'Renovaciones de esta venta, sin contar el pago inicial'}
      >
        <span className="inline-flex items-center justify-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span>{renovaciones ?? '—'}</span>
        </span>
      </TableCell>

      <TableCell className="px-2 py-2 text-center">
        <Badge
          variant="outline"
          className={`font-normal gap-1 ${displayedStatus.variant}`}
        >
          {promiseDisplay ? (
            <CalendarClock className="h-3 w-3 shrink-0" />
          ) : notif.resaltada ? (
            <AlertTriangle className="h-3 w-3 shrink-0" />
          ) : null}
          {displayedStatus.text}
        </Badge>
        {(noticeBadge || noticeState?.noContinuar) ? (
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
            {noticeBadge ? (
              <Badge variant="outline" className={`font-normal ${noticeBadge.className}`} title="Estado del último aviso por WhatsApp">
                {noticeBadge.label}{noticeBadge.dateLabel ? ` · ${noticeBadge.dateLabel}` : ''}
              </Badge>
            ) : null}
            {noticeState?.noContinuar ? (
              <Badge variant="outline" className="border-red-500/60 bg-red-100 font-normal text-red-700 dark:bg-red-500/20 dark:text-red-300">
                No desea continuar
              </Badge>
            ) : null}
          </div>
        ) : null}
      </TableCell>

      <TableCell className="px-2 py-2 text-center">
        <VentasProximasActionsMenu
          notification={notif}
          onNotificar={onNotificar}
          onRenovar={onRenovar}
          onSeguimiento={onSeguimiento}
          onPaymentPromise={onPaymentPromise}
          onCortar={onAcciones}
        />
      </TableCell>
    </TableRow>
  );
}
