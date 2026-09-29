import Link from 'next/link';
import { Pencil, RefreshCw, Trash2 } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
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
  servicio,
  onDelete,
  onRenovar,
}: ServicioDetalleHeaderProps) {
  return (
    <PageHeader
      title={`Servicio: ${servicio.nombre}`}
      trail={[
        { label: categoria?.nombre || 'Categoría', href: `/servicios/${servicio.categoriaId}` },
        { label: 'Detalles' },
      ]}
      actions={
        <>
          <Button asChild variant="outline">
            <Link prefetch={false} href={`/servicios/${id}/editar?from=${encodeURIComponent(`/servicios/detalle/${id}`)}`}>
              <Pencil />
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
