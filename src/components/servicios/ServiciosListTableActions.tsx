import Link from "next/link";
import { Edit, Eye, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ServicioRow } from "./servicios-list-table-types";

export function ServiciosListTableActions({ item }: { item: ServicioRow }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Acciones del servicio">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link prefetch={false} href={`/servicios/detalle/${item.original.id}`}>
            <Eye />
            Ver detalles
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href={`/servicios/${item.original.id}/editar`}>
            <Edit />
            Editar
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
