import Link from 'next/link';
import { Edit, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import type { VentaDoc } from '@/types';

interface VentaDetalleHeaderProps {
  venta: VentaDoc;
  onDelete: () => void;
  onReembolso: () => void | Promise<void>;
  onRenovar: () => void | Promise<void>;
}

export function VentaDetalleHeader({ onDelete, onReembolso, onRenovar, venta }: VentaDetalleHeaderProps) {
  return (
    <PageHeader
      title={`Detalles de Venta: ${venta.clienteNombre}`}
      trail={[{ label: venta.clienteNombre }]}
      actions={
        <>
          <Button variant="outline" onClick={onReembolso} disabled={venta.estado === 'inactivo'}>
            <RotateCcw />
            Reembolso
          </Button>
          <Button asChild variant="outline">
            <Link prefetch={false} href={`/ventas/${venta.id}/editar`}>
              <Edit />
              Editar
            </Link>
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 />
            Eliminar
          </Button>
          <Button onClick={onRenovar}>
            <RefreshCw />
            Renovar
          </Button>
        </>
      }
    />
  );
}
