import Link from "next/link";
import { Edit, Eye, MoreHorizontal, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Tercero } from "@/types";

interface RevendedoresTableActionsProps {
  onDelete: (revendedor: Tercero) => void;
  revendedor: Tercero;
  showView: boolean;
}

export function RevendedoresTableActions({
  onDelete,
  revendedor,
  showView,
}: RevendedoresTableActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {showView && (
          <DropdownMenuItem asChild>
            <Link prefetch={false} href={`/terceros/${revendedor.id}`}>
              <Eye className="mr-2 h-4 w-4" />
              Ver detalles
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link prefetch={false} href={`/terceros/editar/${revendedor.id}`}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(revendedor)}
          className="text-red-500 focus:text-red-500"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
