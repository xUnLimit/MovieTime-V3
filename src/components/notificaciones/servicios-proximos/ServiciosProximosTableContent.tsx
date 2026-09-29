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
              <TableHead className="w-[56px] text-center text-muted-foreground">
                Tipo
              </TableHead>
              <TableHead className="text-center text-muted-foreground">
                Categoría
              </TableHead>
              <TableHead className={`text-center text-muted-foreground ${hideBelowClass('xl')}`}>
                Email
              </TableHead>
              <TableHead className={`text-center text-muted-foreground ${hideBelowClass('2xl')}`}>
                Contraseña
              </TableHead>
              <TableHead className={`text-center text-muted-foreground ${hideBelowClass('2xl')}`}>
                Método de Pago
              </TableHead>
              <TableHead className={`text-center text-muted-foreground ${hideBelowClass('lg')}`}>
                Fecha de Vencimiento
              </TableHead>
              <TableHead className={`text-center text-muted-foreground ${hideBelowClass('md')}`}>
                Monto
              </TableHead>
              <TableHead className="text-center text-muted-foreground">
                Estado
              </TableHead>
              <TableHead className="text-center text-muted-foreground">
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
