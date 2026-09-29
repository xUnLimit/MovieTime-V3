import { hideBelowClass } from '@/components/shared/DataTable';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { VentasProximasTableRow } from './VentasProximasTableRow';
import { Checkbox } from '@/components/ui/checkbox';
import { useVentaNoticeStatus } from '@/hooks/use-whatsapp-notices';
import { useVentaRenewalCounts } from '@/hooks/use-venta-renewal-counts';
import type {
  CopyToClipboardHandler,
  NotificacionVentaConId,
  ToggleLeidaHandler,
  VentaNotificationAction,
} from './types';

interface VentasProximasTableContentProps {
  notificaciones: NotificacionVentaConId[];
  visiblePasswords: ReadonlySet<string>;
  onToggleLeida: ToggleLeidaHandler;
  onCopyToClipboard: CopyToClipboardHandler;
  onTogglePasswordVisibility: (notifId: string) => void;
  onNotificar: VentaNotificationAction;
  onAcciones: VentaNotificationAction;
  onRenovar: VentaNotificationAction;
  onPaymentPromise: VentaNotificationAction;
  onSeguimiento: VentaNotificationAction;
  selectedIds?: ReadonlySet<string>;
  onToggleSelected?: (notifId: string, selected: boolean) => void;
  onToggleAllSelected?: (selected: boolean) => void;
}

export function VentasProximasTableContent({
  notificaciones,
  visiblePasswords,
  onToggleLeida,
  onCopyToClipboard,
  onTogglePasswordVisibility,
  onNotificar,
  onAcciones,
  onRenovar,
  onPaymentPromise,
  onSeguimiento,
  selectedIds,
  onToggleSelected,
  onToggleAllSelected,
}: VentasProximasTableContentProps) {
  const ventaIds = notificaciones.map(notif => notif.ventaId);
  const renewalCounts = useVentaRenewalCounts(ventaIds);
  const noticeStatus = useVentaNoticeStatus(ventaIds);
  const allSelected = notificaciones.length > 0 && notificaciones.every((notif) => selectedIds?.has(notif.id));
  const someSelected = !allSelected && notificaciones.some((notif) => selectedIds?.has(notif.id));
  return (
    <Table>
        <TableHeader>
          <TableRow className="border-b hover:bg-muted/50">
            {onToggleSelected ? (
              <TableHead className="h-10 w-[40px] px-2 text-center">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={(value) => onToggleAllSelected?.(value === true)}
                  aria-label="Seleccionar todos los de esta página"
                />
              </TableHead>
            ) : null}
              <TableHead className="h-10 w-[56px] px-2 text-center text-muted-foreground">
                Tipo
              </TableHead>
              <TableHead className="h-10 min-w-[130px] px-2 text-center text-muted-foreground">
                Cliente
              </TableHead>
              <TableHead className={`h-10 min-w-[130px] px-2 text-center text-muted-foreground ${hideBelowClass('md')}`}>
                Categoría
              </TableHead>
              <TableHead className={`h-10 min-w-[200px] px-2 text-center text-muted-foreground ${hideBelowClass('2xl')}`}>
                Email
              </TableHead>
              <TableHead className={`h-10 min-w-[160px] px-2 text-center text-muted-foreground ${hideBelowClass('3xl')}`}>
                Contraseña
              </TableHead>
              <TableHead className={`h-10 min-w-[100px] px-2 text-center text-muted-foreground ${hideBelowClass('3xl')}`}>
                Perfil
              </TableHead>
              <TableHead className={`h-10 min-w-[90px] px-2 text-center text-muted-foreground ${hideBelowClass('3xl')}`}>
                Código
              </TableHead>
              <TableHead className={`h-10 min-w-[130px] px-2 text-center text-muted-foreground ${hideBelowClass('3xl')}`}>
                Fecha de Inicio
              </TableHead>
              <TableHead className={`h-10 min-w-[145px] px-2 text-center text-muted-foreground ${hideBelowClass('lg')}`}>
                Fecha de Vencimiento
              </TableHead>
              <TableHead className={`h-10 min-w-[80px] px-2 text-center text-muted-foreground ${hideBelowClass('md')}`}>
                Monto
              </TableHead>
              <TableHead className={`h-10 min-w-[120px] px-2 text-center text-muted-foreground ${hideBelowClass('3xl')}`}>
                Renovaciones
              </TableHead>
              <TableHead className="h-10 min-w-[125px] px-2 text-center text-muted-foreground">
                Estado
              </TableHead>
              <TableHead className="h-10 min-w-[74px] px-2 text-center text-muted-foreground">
                Acciones
              </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {notificaciones.map((notif) => (
            <VentasProximasTableRow
              key={notif.id}
              notif={notif}
              renovaciones={renewalCounts.data?.[notif.ventaId]}
              renovacionesError={renewalCounts.isError}
              noticeState={noticeStatus.data?.[notif.ventaId]}
              selected={selectedIds?.has(notif.id) ?? false}
              onSelectedChange={onToggleSelected}
              visiblePasswords={visiblePasswords}
              onToggleLeida={onToggleLeida}
              onCopyToClipboard={onCopyToClipboard}
              onTogglePasswordVisibility={onTogglePasswordVisibility}
              onNotificar={onNotificar}
              onAcciones={onAcciones}
              onRenovar={onRenovar}
              onPaymentPromise={onPaymentPromise}
              onSeguimiento={onSeguimiento}
            />
          ))}
        </TableBody>
    </Table>
  );
}
