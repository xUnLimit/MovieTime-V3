import Link from "next/link";
import { Edit, Eye, MoreHorizontal, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Servicio } from "@/types";

interface ServiciosCategoriaTableDetalleActionsProps {
  onDelete: (servicio: Servicio) => void;
  onView?: (id: string) => void;
  pathname: string;
  servicio: Servicio;
}

export function ServiciosCategoriaTableDetalleActions({
  onDelete,
  onView,
  pathname,
  servicio,
}: ServiciosCategoriaTableDetalleActionsProps) {
  const fromParam = encodeURIComponent(pathname);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onView && (
          <DropdownMenuItem asChild>
            <Link
              prefetch={false}
              href={`/servicios/detalle/${servicio.id}?from=${fromParam}`}
            >
              <Eye className="mr-2 h-4 w-4" />
              Ver detalles
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link
            prefetch={false}
            href={`/servicios/${servicio.id}/editar?from=${fromParam}`}
          >
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(servicio)}
          className="text-red-500 focus:text-red-500"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
