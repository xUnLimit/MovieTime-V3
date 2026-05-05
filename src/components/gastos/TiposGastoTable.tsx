'use client';

import { useMemo, useState } from 'react';
import { Edit, MoreHorizontal, Power, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Column, DataTable } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TipoGasto } from '@/types';

interface TiposGastoTableProps {
  tiposGasto: TipoGasto[];
  onEdit: (tipoGasto: TipoGasto) => void;
  onToggleActivo: (tipoGasto: TipoGasto) => Promise<void>;
  title?: string;
}

export function TiposGastoTable({
  tiposGasto,
  onEdit,
  onToggleActivo,
  title = 'Catálogo de tipos de gasto',
}: TiposGastoTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTipos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tiposGasto;

    return tiposGasto.filter((tipo) =>
      `${tipo.nombre} ${tipo.descripcion ?? ''}`.toLowerCase().includes(query)
    );
  }, [searchQuery, tiposGasto]);

  const columns: Column<TipoGasto>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      sortable: true,
      width: '25%',
      render: (item) => <span className="font-medium">{item.nombre}</span>,
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      width: '25%',
      render: (item) => (
        <span className={item.descripcion ? '' : 'text-muted-foreground'}>
          {item.descripcion || 'Sin descripción'}
        </span>
      ),
    },
    {
      key: 'activo',
      header: 'Estado',
      sortable: true,
      align: 'center',
      width: '45%',
      render: (item) => (
        <Badge
          variant="outline"
          className={
            item.activo
              ? 'text-xs border-green-500/50 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
              : 'text-xs border-zinc-500/50 bg-zinc-100 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300'
          }
        >
          {item.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
  ];

  const handleToggleActivo = async (tipoGasto: TipoGasto) => {
    try {
      await onToggleActivo(tipoGasto);
      toast.success(tipoGasto.activo ? 'Tipo inactivado' : 'Tipo activado', {
        description: 'El catálogo fue actualizado correctamente.',
      });
    } catch (error) {
      toast.error('Error al actualizar tipo de gasto', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <Card className="p-4 pb-2">
      <h3 className="text-xl font-semibold">{title}</h3>

      <div className="flex flex-col gap-4 -mb-4 xl:flex-row xl:items-center">
        <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar tipo de gasto..."
          className="pl-9"
        />
        </div>
      </div>

      <DataTable
        data={filteredTipos as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        emptyMessage="No hay tipos de gasto registrados"
        pagination
        itemsPerPageOptions={[10, 25, 50]}
        actions={(item) => {
          const tipoGasto = item as unknown as TipoGasto;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(tipoGasto)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleToggleActivo(tipoGasto)}
                  className={tipoGasto.activo ? 'text-red-500 focus:text-red-500' : 'text-green-600 focus:text-green-600'}
                >
                  <Power className="h-4 w-4 mr-2" />
                  {tipoGasto.activo ? 'Inactivar' : 'Activar'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }}
      />
    </Card>
  );
}
