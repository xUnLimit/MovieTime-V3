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
        <Button variant="ghost" size="icon-sm">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {showView && (
          <DropdownMenuItem asChild>
            <Link prefetch={false} href={`/terceros/${revendedor.id}`}>
              <Eye />
              Ver detalles
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link prefetch={false} href={`/terceros/editar/${revendedor.id}`}>
            <Edit />
            Editar
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(revendedor)}
          className="text-danger focus:text-danger"
        >
          <Trash2 />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
