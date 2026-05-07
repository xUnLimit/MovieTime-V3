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
}: VentasProximasTableContentProps) {
  return (
    <div className="rounded-md border">
      <div className="table-scroll-shell">
        <Table className="table-scroll-content min-w-[1240px]">
          <TableHeader>
            <TableRow className="border-b hover:bg-muted/50">
              <TableHead className="h-12 px-4 text-center text-muted-foreground w-[80px]">
                Tipo
              </TableHead>
              <TableHead className="h-12 min-w-[170px] px-4 text-center text-muted-foreground">
                Cliente
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
              <TableHead className="h-12 min-w-[120px] px-4 text-center text-muted-foreground">
                Perfil
              </TableHead>
              <TableHead className="h-12 min-w-[110px] px-4 text-center text-muted-foreground">
                Código
              </TableHead>
              <TableHead className="h-12 min-w-[150px] px-4 text-center text-muted-foreground">
                Fecha de Inicio
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
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
