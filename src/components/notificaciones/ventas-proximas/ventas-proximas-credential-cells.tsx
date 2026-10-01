import { Copy, Eye, EyeOff } from 'lucide-react';
import { hideBelowClass } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { TableCell } from '@/components/ui/table';
import type { CopyToClipboardHandler, NotificacionVentaConId } from './types';

export function VentasProximasCredentialCells({ notif, isPasswordVisible, onCopyToClipboard, onTogglePasswordVisibility }: {
  notif: NotificacionVentaConId;
  isPasswordVisible: boolean;
  onCopyToClipboard: CopyToClipboardHandler;
  onTogglePasswordVisibility: (notifId: string) => void;
}) {
  return <>
      <TableCell className={`text-center ${hideBelowClass('2xl')}`}>
        {notif.servicioCorreo ? (
          <div className="flex items-center justify-center gap-2">
            <span className="max-w-36 truncate font-medium">
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

      <TableCell className={`w-32 text-center ${hideBelowClass('3xl')}`}>
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

  </>;
}
