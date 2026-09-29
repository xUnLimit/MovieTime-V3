import Link from 'next/link';
import { Edit, Eye, MoreHorizontal, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TerceroDisplay } from './todos-terceros-table-types';

interface TodosTercerosTableActionsProps {
  item: TerceroDisplay;
  onDelete: (usuario: TerceroDisplay) => void;
  showView: boolean;
}

export function TodosTercerosTableActions({
  item,
  onDelete,
  showView,
}: TodosTercerosTableActionsProps) {
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
            <Link prefetch={false} href={`/terceros/${item.id}`}>
              <Eye />
              Ver detalles
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link prefetch={false} href={`/terceros/editar/${item.id}`}>
            <Edit />
            Editar
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(item)}
          className="text-danger focus:text-danger"
        >
          <Trash2 />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
