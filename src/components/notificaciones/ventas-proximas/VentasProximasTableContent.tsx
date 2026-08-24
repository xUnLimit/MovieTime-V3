import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { VentasProximasTableRow } from './VentasProximasTableRow';
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
  onCancelar: VentaNotificationAction;
  onAcciones: VentaNotificationAction;
  onRenovar: VentaNotificationAction;
  onPaymentPromise: VentaNotificationAction;
  onClearLegacyHighlight: VentaNotificationAction;
}

export function VentasProximasTableContent({
  notificaciones,
  visiblePasswords,
  onToggleLeida,
  onCopyToClipboard,
  onTogglePasswordVisibility,
  onNotificar,
  onCancelar,
  onAcciones,
  onRenovar,
  onPaymentPromise,
  onClearLegacyHighlight,
}: VentasProximasTableContentProps) {
  return (
    <div className="notification-table-scroll-shell rounded-md border">
      <Table className="table-scroll-content min-w-[1420px] xl:min-w-full">
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
              visiblePasswords={visiblePasswords}
              onToggleLeida={onToggleLeida}
              onCopyToClipboard={onCopyToClipboard}
              onTogglePasswordVisibility={onTogglePasswordVisibility}
              onNotificar={onNotificar}
              onCancelar={onCancelar}
              onAcciones={onAcciones}
              onRenovar={onRenovar}
              onPaymentPromise={onPaymentPromise}
              onClearLegacyHighlight={onClearLegacyHighlight}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
