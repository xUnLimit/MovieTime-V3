import Link from 'next/link';
import { ArrowLeft, Pencil, RefreshCw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { CategoriaDetalle, ServicioDetalle } from './types';

interface ServicioDetalleHeaderProps {
  categoria: CategoriaDetalle | null;
  id: string;
  returnToServicios: string;
  servicio: ServicioDetalle;
  onDelete: () => void;
  onRenovar: () => void | Promise<void>;
}

export function ServicioDetalleHeader({
  categoria,
  id,
  returnToServicios,
  servicio,
  onDelete,
  onRenovar,
}: ServicioDetalleHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Link href={returnToServicios}>
          <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Servicio: {servicio.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
            {' / '}
            <Link href="/servicios" className="hover:text-foreground transition-colors">
              Servicios
            </Link>
            {' / '}
            <Link href={`/servicios/${servicio.categoriaId}`} className="hover:text-foreground transition-colors">
              {categoria?.nombre || 'Categoría'}
            </Link>
            {' / '}
            <span className="text-foreground">Detalles</span>
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="default" size="sm" onClick={onRenovar} className="bg-purple-600 hover:bg-purple-700">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Renovar
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/servicios/${id}/editar?from=${encodeURIComponent(`/servicios/detalle/${id}`)}`}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
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
