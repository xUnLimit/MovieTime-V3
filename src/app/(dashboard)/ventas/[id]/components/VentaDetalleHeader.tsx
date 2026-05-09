import Link from 'next/link';
import { ArrowLeft, Edit, RefreshCw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { VentaDoc } from '@/types';

interface VentaDetalleHeaderProps {
  venta: VentaDoc;
  onDelete: () => void;
  onRenovar: () => void | Promise<void>;
}

export function VentaDetalleHeader({ onDelete, onRenovar, venta }: VentaDetalleHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link prefetch={false} href="/ventas">
          <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Detalles de Venta: {venta.clienteNombre}</h1>
          <p className="text-sm text-muted-foreground">
            <Link prefetch={false} href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
            {' / '}
            <Link prefetch={false} href="/ventas" className="hover:text-foreground transition-colors">Ventas</Link>
            {' / '}
            <span className="text-foreground">{venta.clienteNombre}</span>
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        <Button
          variant="default"
          size="sm"
          className="bg-purple-600 hover:bg-purple-700"
          onClick={onRenovar}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Renovar
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link prefetch={false} href={`/ventas/${venta.id}/editar`}>
            <Edit className="h-3.5 w-3.5 mr-1.5" />
            Editar
          </Link>
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Eliminar
        </Button>
      </div>
    </div>
  );
}
