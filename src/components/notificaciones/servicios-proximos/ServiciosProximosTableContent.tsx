import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { ServiciosProximosTableRow } from './ServiciosProximosTableRow';
import type {
  CopyToClipboardHandler,
  NotificacionServicioConId,
  ServicioNotificationAction,
  ToggleLeidaHandler,
} from './types';

interface ServiciosProximosTableContentProps {
  notificaciones: NotificacionServicioConId[];
  visiblePasswords: ReadonlySet<string>;
  onToggleLeida: ToggleLeidaHandler;
  onCopyToClipboard: CopyToClipboardHandler;
  onTogglePasswordVisibility: (notifId: string) => void;
  onRenovar: ServicioNotificationAction;
  onAcciones: ServicioNotificationAction;
}

export function ServiciosProximosTableContent({
  notificaciones,
  visiblePasswords,
  onToggleLeida,
  onCopyToClipboard,
  onTogglePasswordVisibility,
  onRenovar,
  onAcciones,
}: ServiciosProximosTableContentProps) {
  return (
    <div className="notification-table-scroll-shell rounded-md border">
      <Table className="table-scroll-content min-w-[1120px] lg:min-w-full">
          <TableHeader>
            <TableRow className="border-b hover:bg-muted/50">
              <TableHead className="h-10 w-[56px] px-2 text-center text-muted-foreground">
                Tipo
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
              <TableHead className="h-10 min-w-[150px] px-2 text-center text-muted-foreground">
                Método de Pago
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
              <ServiciosProximosTableRow
                key={notif.id}
                notif={notif}
                visiblePasswords={visiblePasswords}
                onToggleLeida={onToggleLeida}
                onCopyToClipboard={onCopyToClipboard}
                onTogglePasswordVisibility={onTogglePasswordVisibility}
                onRenovar={onRenovar}
                onAcciones={onAcciones}
              />
            ))}
          </TableBody>
        </Table>
    </div>
  );
}
