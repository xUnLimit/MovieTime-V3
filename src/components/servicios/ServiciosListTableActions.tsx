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
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link prefetch={false} href={`/servicios/detalle/${item.original.id}`}>
            <Eye className="mr-2 h-4 w-4" />
            Ver detalles
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link prefetch={false} href={`/servicios/${item.original.id}/editar`}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
