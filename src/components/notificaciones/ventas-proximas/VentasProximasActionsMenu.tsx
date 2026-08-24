import Link from 'next/link';
import {
  CalendarClock,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Scissors,
  ShoppingCart,
  Star,
  StarOff,
  Tv2,
  User,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { NotificacionVentaConId, VentaNotificationAction } from './types';

interface VentasProximasActionsMenuProps {
  notification: NotificacionVentaConId;
  onNotificar: VentaNotificationAction;
  onRenovar: VentaNotificationAction;
  onSeguimiento: VentaNotificationAction;
  onPaymentPromise: VentaNotificationAction;
  onCortar: VentaNotificationAction;
}

export function VentasProximasActionsMenu({
  notification,
  onNotificar,
  onRenovar,
  onSeguimiento,
  onPaymentPromise,
  onCortar,
}: VentasProximasActionsMenuProps) {
  const FollowUpIcon = notification.resaltada ? StarOff : Star;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`Abrir acciones de ${notification.clienteNombre}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onNotificar(notification)}>
          <MessageSquare className="mr-2 h-4 w-4 text-green-600" />
          <span className="text-green-600">Notificar</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onRenovar(notification)}>
          <RefreshCw className="mr-2 h-4 w-4 text-purple-600" />
          <span className="text-purple-600">Renovar</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSeguimiento(notification)}>
          <FollowUpIcon className="mr-2 h-4 w-4 text-orange-600" />
          <span className="text-orange-600">
            {notification.resaltada ? 'Quitar seguimiento' : 'Seguimiento'}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPaymentPromise(notification)}>
          <CalendarClock className="mr-2 h-4 w-4 text-blue-600" />
          <span className="text-blue-600">
            {notification.fechaPrometidaPago ? 'Editar promesa' : 'Promesa de pago'}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onCortar(notification)}>
          <Scissors className="mr-2 h-4 w-4 text-red-600" />
          <span className="text-red-600">Cortar</span>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link prefetch={false} href={`/terceros/${notification.clienteId}`}>
            <User className="mr-2 h-4 w-4" />
            Ver Cliente
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link prefetch={false} href={`/ventas/${notification.ventaId}`}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Ver Venta
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link prefetch={false} href={`/servicios/detalle/${notification.servicioId}`}>
            <Tv2 className="mr-2 h-4 w-4" />
            Ver Servicio
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
