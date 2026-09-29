'use client';

import { useMemo, useState } from 'react';
import { Edit, MoreHorizontal, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DataTable, defineDataTableColumns } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TableCard } from '@/components/shared/TableCard';
import { TableSearch, TableToolbar } from '@/components/shared/TableToolbar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TipoGasto } from '@/types';

interface TiposGastoTableProps {
  tiposGasto: TipoGasto[];
  onEdit: (tipoGasto: TipoGasto) => void;
  onToggleActivo: (tipoGasto: TipoGasto) => Promise<void>;
  onDelete: (tipoGasto: TipoGasto) => Promise<void>;
  title?: string;
}

export function TiposGastoTable({
  tiposGasto,
  onEdit,
  onToggleActivo,
  onDelete,
  title = 'Catálogo de tipos de gasto',
}: TiposGastoTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tipoToDelete, setTipoToDelete] = useState<TipoGasto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredTipos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tiposGasto;

    return tiposGasto.filter((tipo) =>
      `${tipo.nombre} ${tipo.descripcion ?? ''}`.toLowerCase().includes(query)
    );
  }, [searchQuery, tiposGasto]);

  const columns = defineDataTableColumns<TipoGasto>([
    {
      key: 'nombre',
      header: 'Nombre',
      sortable: true,
      render: (item) => <span className="font-medium">{item.nombre}</span>,
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      hideBelow: 'sm',
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
      render: (item) => (
        <StatusBadge tone={item.activo ? 'success' : 'neutral'}>{item.activo ? 'Activo' : 'Inactivo'}</StatusBadge>
      ),
    },
  ]);

  const handleToggleActivo = async (tipoGasto: TipoGasto) => {
    try {
      await onToggleActivo(tipoGasto);
      toast.success(tipoGasto.activo ? 'Tipo inactivado' : 'Tipo activado', {
        description: 'El catálogo fue actualizado correctamente.',
      });
    } catch (error) {
      toast.error('Error al actualizar tipo de gasto', {
        description: getPublicErrorMessage(error, 'No se pudo actualizar el tipo de gasto.'),
      });
    }
  };

  const handleDelete = async () => {
    if (!tipoToDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(tipoToDelete);
      toast.success('Tipo de gasto eliminado', {
        description: 'El catálogo fue actualizado correctamente.',
      });
      setTipoToDelete(null);
    } catch (error) {
      toast.error('Error al eliminar tipo de gasto', {
        description: getPublicErrorMessage(error, 'No se pudo eliminar el tipo de gasto.'),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <TableCard
      title={title}
      toolbar={
        <TableToolbar>
          <TableSearch value={searchQuery} onChange={setSearchQuery} placeholder="Buscar tipo de gasto..." />
        </TableToolbar>
      }
    >
      <DataTable
        bare
        autoPageSize
        data={filteredTipos}
        columns={columns}
        emptyMessage="No hay tipos de gasto registrados"
        pagination
        actions={(item) => {
          const tipoGasto = item;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Acciones del tipo de gasto">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(tipoGasto)}>
                  <Edit />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleToggleActivo(tipoGasto)}
                  className={tipoGasto.activo ? 'text-danger focus:text-danger' : 'text-success focus:text-success'}
                >
                  <Power />
                  {tipoGasto.activo ? 'Inactivar' : 'Activar'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setTipoToDelete(tipoGasto)}
                  variant="destructive"
                >
                  <Trash2 />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }}
      />

      <ConfirmDialog
        open={tipoToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setTipoToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Eliminar tipo de gasto"
        description={`¿Seguro que deseas eliminar "${tipoToDelete?.nombre ?? ''}"? Solo se puede eliminar si no tiene gastos asociados.`}
        confirmText="Eliminar"
        variant="danger"
        loading={isDeleting}
      />
    </TableCard>
  );
}
