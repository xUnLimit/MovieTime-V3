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

import { hideBelowClass } from '@/components/shared/DataTable';
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
    ? 'bg-warning-subtle'
    : promiseDisplay
      ? promiseOverdue
        ? 'bg-danger-subtle'
        : 'bg-info-subtle'
      : '';
  const displayedStatus = promiseDisplay
    ? {
        text: promiseDisplay.text,
        variant: promiseOverdue
          ? 'border-danger-border bg-danger-subtle text-danger'
          : 'border-info-border bg-info-subtle text-info',
      }
    : estadoBadge;

  return (
    <TableRow className={`border-b transition-colors hover:bg-muted/50 ${rowToneClass}`}>
      {onSelectedChange ? (
        <TableCell className="w-8 px-1 py-2 text-center">
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
                ? 'bg-danger-subtle hover:bg-danger/15'
                : 'bg-info-subtle hover:bg-info/15'
              : notif.resaltada
              ? 'bg-warning-subtle hover:bg-warning/15'
              : notif.leida
                ? 'bg-muted hover:bg-accent'
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
                promiseOverdue ? 'text-danger' : 'text-info'
              }`}
            />
          ) : notif.resaltada ? (
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

      <TableCell className="px-2 py-2 text-center font-medium">
        <span className="inline-block max-w-[130px] truncate align-middle max-sm:max-w-24">
          {notif.clienteNombre}
        </span>
      </TableCell>

      <TableCell className={`px-2 py-2 text-center ${hideBelowClass('md')}`}>
        <div className="mx-auto flex max-w-[130px] flex-col max-sm:max-w-24 items-center gap-0.5">
          <span className="w-full truncate font-medium">
            {notif.categoriaNombre}
          </span>
          <span className="w-full truncate text-xs text-muted-foreground">
            {notif.servicioNombre || '-'}
          </span>
        </div>
      </TableCell>

      <TableCell className={`px-2 py-2 text-center ${hideBelowClass('2xl')}`}>
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

      <TableCell className={`w-[160px] px-2 py-2 text-center ${hideBelowClass('3xl')}`}>
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

      <TableCell className={`px-2 py-2 text-center ${hideBelowClass('3xl')}`}>
            <span className="inline-block max-w-[100px] truncate font-medium align-middle">
              {notif.perfilNombre || '-'}
            </span>
      </TableCell>

      <TableCell className={`px-2 py-2 text-center ${hideBelowClass('3xl')}`}>
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

      <TableCell className={`px-2 py-2 text-center ${hideBelowClass('3xl')}`}>
        {notif.fechaInicio ? formatearFecha(new Date(notif.fechaInicio)) : '—'}
      </TableCell>

      <TableCell className={`px-2 py-2 text-center ${hideBelowClass('lg')}`}>
        {formatearFecha(new Date(notif.fechaFin))}
      </TableCell>

      <TableCell className={`px-2 py-2 text-center ${hideBelowClass('md')}`}>
        {getCurrencySymbol(notif.moneda)}
        {notif.precioFinal?.toFixed(2) || '0.00'}
      </TableCell>

      <TableCell
        className={`px-2 py-2 text-center tabular-nums ${hideBelowClass('3xl')}`}
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
          className={`font-normal gap-1 ${displayedStatus.variant} max-sm:max-w-24 max-sm:whitespace-normal max-sm:text-center`}
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
              <Badge variant="outline" className="border-danger-border bg-danger-subtle font-normal text-danger">
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
