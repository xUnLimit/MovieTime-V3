"use client";

import { useState, useMemo } from "react";
import { MetodoPago } from "@/types";
import { DataTable, defineDataTableColumns } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TableCard } from "@/components/shared/TableCard";
import { FilterMenu, TableSearch, TableToolbar } from "@/components/shared/TableToolbar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe2, MoreHorizontal, Edit, Trash2, Eye } from "lucide-react";
import { deleteMetodoPagoMutation } from "@/application/client-domain-mutations";
import { getPublicErrorMessage } from "@/platform/errors/public-errors";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";
import Link from "next/link";

interface TercerosMetodosPagoTableProps {
  metodosPago: MetodoPago[];
  title?: string;
  onMetodoDeleted?: () => void | Promise<void>;
}

export function TercerosMetodosPagoTable({
  metodosPago,
  title = "Métodos de pago de Terceros",
  onMetodoDeleted,
}: TercerosMetodosPagoTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [metodoToDelete, setMetodoToDelete] = useState<MetodoPago | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [paisFilter, setPaisFilter] = useState("todos");

  // Filtrar solo métodos de tercero
  const metodosTerceros = useMemo(() => {
    return metodosPago.filter((m) => m.asociadoA === "tercero");
  }, [metodosPago]);

  // Obtener países únicos
  const paisesUnicos = useMemo(() => {
    const paises = new Set(metodosTerceros.map((m) => m.pais));
    return Array.from(paises).filter(Boolean);
  }, [metodosTerceros]);

  // Filtrar y ordenar métodos de pago
  const filteredMetodos = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const filtered = metodosTerceros.filter((metodo) => {
      const matchesSearch =
        metodo.nombre.toLowerCase().includes(query) ||
        metodo.titular.toLowerCase().includes(query) ||
        metodo.identificador.toLowerCase().includes(query) ||
        metodo.alias?.toLowerCase().includes(query);
      const matchesPais = paisFilter === "todos" || metodo.pais === paisFilter;
      return matchesSearch && matchesPais;
    });
    // Ordenar alfabéticamente por nombre
    return filtered.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [metodosTerceros, searchQuery, paisFilter]);

  
  const handleDelete = (metodo: MetodoPago) => {
    setMetodoToDelete(metodo);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (metodoToDelete) {
      try {
        await deleteMetodoPagoMutation(metodoToDelete.id, metodoToDelete);
        await onMetodoDeleted?.();
        toast.success("Método de pago eliminado");
      } catch (error) {
        toast.error("Error al eliminar método de pago", {
          description: getPublicErrorMessage(error, "No se pudo eliminar el método de pago."),
        });
      }
    }
  };

  const tipoCuentaLabels: Record<string, string> = {
    ahorro: "Ahorro",
    corriente: "Corriente",
    wallet: "Wallet",
    telefono: "Teléfono",
    email: "Email",
  };

  const paisOptions = useMemo(
    () => [
      { value: "todos", label: "Todos los países" },
      ...paisesUnicos.map((p) => ({ value: p, label: p })),
    ],
    [paisesUnicos],
  );

  const columns = defineDataTableColumns<MetodoPago>([
    {
      key: "nombre",
      header: "Método",
      sortable: true,
      render: (item) => {
        const alias = item.alias?.trim();

        return (
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{item.banco || item.nombre}</span>
            <span
              className={`truncate text-xs leading-tight text-muted-foreground ${
                alias ? "" : "invisible"
              }`}
              aria-hidden={!alias}
            >
              {alias || "\u00a0"}
            </span>
          </div>
        );
      },
    },
    {
      key: "pais",
      hideBelow: "lg",
      header: "País",
      sortable: true,
      align: "center",
    },
    {
      key: "titular",
      hideBelow: "sm",
      header: "Titular",
      sortable: true,
      align: "center",
    },
    {
      key: "tipoCuenta",
      hideBelow: "xl",
      header: "Tipo Cuenta",
      sortable: false,
      align: "center",
      render: (item) => (
        <span>{item.tipoCuenta ? tipoCuentaLabels[item.tipoCuenta] : "-"}</span>
      ),
    },
    {
      key: "identificador",
      hideBelow: "md",
      header: "Identificador",
      sortable: false,
      align: "center",
      render: (item) => <span className="text-sm">{item.identificador}</span>,
    },
    {
      key: "activo",
      header: "Estado",
      sortable: true,
      align: "center",
      render: (item) => (
        <StatusBadge tone={item.activo ? "success" : "danger"}>{item.activo ? "Activo" : "Inactivo"}</StatusBadge>
      ),
    },
  ]);

  return (
    <>
      <TableCard
        title={title}
        toolbar={
          <TableToolbar>
            <TableSearch value={searchQuery} onChange={setSearchQuery} placeholder="Buscar por método, titular, alias..." />
            <FilterMenu icon={Globe2} ariaLabel="País" value={paisFilter} options={paisOptions} onChange={setPaisFilter} />
          </TableToolbar>
        }
      >
          <DataTable
            bare
            autoPageSize
            pagination
            data={filteredMetodos}
            columns={columns}
            emptyMessage="No se encontraron métodos de pago"
            actions={(item) => {
              const metodo = item;
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Acciones del método de pago">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link prefetch={false} href={`/metodos-pago/${metodo.id}`}>
                        <Eye />
                        Ver detalles
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link prefetch={false} href={`/metodos-pago/${metodo.id}/editar`}>
                        <Edit />
                        Editar
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(metodo)}
                      className="text-danger focus:text-danger"
                    >
                      <Trash2 />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }}
          />
      </TableCard>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Eliminar Método de Pago"
        description={`¿Estás seguro de que quieres eliminar el método "${metodoToDelete?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      />
    </>
  );
}
