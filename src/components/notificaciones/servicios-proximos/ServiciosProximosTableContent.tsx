import { hideBelowClass } from '@/components/shared/DataTable';
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
  onSeguimiento: ServicioNotificationAction;
  onAcciones: ServicioNotificationAction;
}

export function ServiciosProximosTableContent({
  notificaciones,
  visiblePasswords,
  onToggleLeida,
  onCopyToClipboard,
  onTogglePasswordVisibility,
  onRenovar,
  onSeguimiento,
  onAcciones,
}: ServiciosProximosTableContentProps) {
  return (
    <Table>
          <TableHeader>
            <TableRow className="border-b hover:bg-muted/50">
              <TableHead className="h-10 w-[56px] px-2 text-center text-muted-foreground">
                Tipo
              </TableHead>
              <TableHead className="h-10 min-w-[130px] px-2 text-center text-muted-foreground">
                Categoría
              </TableHead>
              <TableHead className={`h-10 min-w-[200px] px-2 text-center text-muted-foreground ${hideBelowClass('xl')}`}>
                Email
              </TableHead>
              <TableHead className={`h-10 min-w-[160px] px-2 text-center text-muted-foreground ${hideBelowClass('2xl')}`}>
                Contraseña
              </TableHead>
              <TableHead className={`h-10 min-w-[150px] px-2 text-center text-muted-foreground ${hideBelowClass('2xl')}`}>
                Método de Pago
              </TableHead>
              <TableHead className={`h-10 min-w-[145px] px-2 text-center text-muted-foreground ${hideBelowClass('lg')}`}>
                Fecha de Vencimiento
              </TableHead>
              <TableHead className={`h-10 min-w-[80px] px-2 text-center text-muted-foreground ${hideBelowClass('md')}`}>
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
                onSeguimiento={onSeguimiento}
                onAcciones={onAcciones}
              />
            ))}
          </TableBody>
        </Table>
  );
}
