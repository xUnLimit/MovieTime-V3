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
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {showView && (
          <DropdownMenuItem asChild>
            <Link prefetch={false} href={`/terceros/${item.id}`}>
              <Eye className="mr-2 h-4 w-4" />
              Ver detalles
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link prefetch={false} href={`/terceros/editar/${item.id}`}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(item)}
          className="text-red-500 focus:text-red-500"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
