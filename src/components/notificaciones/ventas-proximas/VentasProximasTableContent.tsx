import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { VentasProximasTableRow } from './VentasProximasTableRow';
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
}: VentasProximasTableContentProps) {
  const renewalCounts = useVentaRenewalCounts(notificaciones.map(notif => notif.ventaId));
  return (
    <div className="notification-table-scroll-shell rounded-md border">
      <Table className="table-scroll-content min-w-[1540px] xl:min-w-full">
        <TableHeader>
          <TableRow className="border-b hover:bg-muted/50">
              <TableHead className="h-10 w-[56px] px-2 text-center text-muted-foreground">
                Tipo
              </TableHead>
              <TableHead className="h-10 min-w-[130px] px-2 text-center text-muted-foreground">
                Cliente
              </TableHead>
              <TableHead className="h-10 min-w-[130px] px-2 text-center text-muted-foreground">
                Categoría
              </TableHead>
              <TableHead className="h-10 min-w-[200px] px-2 text-center text-muted-foreground">
                Email
              </TableHead>
              <TableHead className="h-10 min-w-[160px] px-2 text-center text-muted-foreground">
                Contraseña
              </TableHead>
              <TableHead className="h-10 min-w-[100px] px-2 text-center text-muted-foreground">
                Perfil
              </TableHead>
              <TableHead className="h-10 min-w-[90px] px-2 text-center text-muted-foreground">
                Código
              </TableHead>
              <TableHead className="h-10 min-w-[130px] px-2 text-center text-muted-foreground">
                Fecha de Inicio
              </TableHead>
              <TableHead className="h-10 min-w-[145px] px-2 text-center text-muted-foreground">
                Fecha de Vencimiento
              </TableHead>
              <TableHead className="h-10 min-w-[80px] px-2 text-center text-muted-foreground">
                Monto
              </TableHead>
              <TableHead className="h-10 min-w-[120px] px-2 text-center text-muted-foreground">
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
    </div>
  );
}
