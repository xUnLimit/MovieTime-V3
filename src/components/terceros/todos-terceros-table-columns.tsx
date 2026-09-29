import { MessageCircle, Monitor } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Column } from '@/components/shared/DataTable';
import type { TerceroDisplay } from './todos-terceros-table-types';

export function createTodosTercerosColumns(
  onWhatsApp: (usuario: TerceroDisplay) => void,
): Column<TerceroDisplay>[] {
  return [
    {
      key: 'nombre',
      header: 'Nombre',
      sortable: true,
      render: (item) => (
        <div className="font-medium">
          {item.nombre} {item.apellido}
        </div>
      ),
    },
    {
      key: 'tipo',
      hideBelow: 'lg',
      header: 'Tipo',
      sortable: false,
      align: 'center',
      render: (item) => <span>{item.tipo}</span>,
    },
    {
      key: 'metodoPagoNombre',
      hideBelow: 'xl',
      header: 'Método de Pago',
      sortable: false,
      align: 'center',
    },
    {
      key: 'serviciosActivos',
      header: 'Servicios Activos',
      sortable: true,
      align: 'center',
      render: (item) => {
        const isActive = item.serviciosActivos > 0;
        return (
          <div className="flex items-center justify-center gap-2">
            <Monitor
              className={`h-4 w-4 ${isActive ? 'text-success' : 'text-muted-foreground'}`}
            />
            <span className={isActive ? '' : 'text-muted-foreground'}>
              {item.serviciosActivos}
            </span>
          </div>
        );
      },
    },
    {
      key: 'montoSinConsumir',
      hideBelow: 'md',
      header: 'Monto Sin Consumir',
      sortable: true,
      align: 'center',
      render: (item) => {
        const isActive = item.serviciosActivos > 0;
        return (
          <div className="flex items-center justify-center gap-1">
            <span
              className={
                isActive
                  ? 'font-medium text-success'
                  : 'text-muted-foreground'
              }
            >
              $
            </span>
            <span
              className={isActive ? 'font-medium' : 'text-muted-foreground'}
            >
              {item.montoSinConsumir.toFixed(2)}
            </span>
          </div>
        );
      },
    },
    {
      key: 'contacto',
      hideBelow: 'sm',
      header: 'Contacto',
      align: 'center',
      render: (item) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onWhatsApp(item);
          }}
          className="h-auto p-0 text-success hover:text-success"
        >
          <MessageCircle className="mr-1 h-4 w-4" />
          WhatsApp
        </Button>
      ),
    },
  ];
}
