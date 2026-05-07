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
    <div className="rounded-md border">
      <div className="table-scroll-shell">
        <Table className="table-scroll-content min-w-[980px]">
          <TableHeader>
            <TableRow className="border-b hover:bg-muted/50">
              <TableHead className="h-12 px-4 text-center text-muted-foreground w-[80px]">
                Tipo
              </TableHead>
              <TableHead className="h-12 min-w-[170px] px-4 text-center text-muted-foreground">
                Categoría
              </TableHead>
              <TableHead className="h-12 min-w-[220px] px-4 text-center text-muted-foreground">
                Email
              </TableHead>
              <TableHead className="h-12 min-w-[190px] px-4 text-center text-muted-foreground">
                Contraseña
              </TableHead>
              <TableHead className="h-12 min-w-[180px] px-4 text-center text-muted-foreground">
                Método de Pago
              </TableHead>
              <TableHead className="h-12 min-w-[170px] px-4 text-center text-muted-foreground">
                Fecha de Vencimiento
              </TableHead>
              <TableHead className="h-12 min-w-[100px] px-4 text-center text-muted-foreground">
                Monto
              </TableHead>
              <TableHead className="h-12 min-w-[150px] px-4 text-center text-muted-foreground">
                Estado
              </TableHead>
              <TableHead className="h-12 min-w-[96px] px-4 text-center text-muted-foreground">
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
    </div>
  );
}
