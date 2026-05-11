"use client";

import { useState, useMemo } from "react";
import { MetodoPago } from "@/types";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, Edit, Trash2, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMetodosPagoStore } from "@/store/metodosPagoStore";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";
import Link from "next/link";

interface ServiciosMetodosPagoTableProps {
  metodosPago: MetodoPago[];
  title?: string;
}

export function ServiciosMetodosPagoTable({
  metodosPago,
  title = "Métodos de pago de Servicios",
}: ServiciosMetodosPagoTableProps) {
    const { deleteMetodoPago, fetchCounts } = useMetodosPagoStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [metodoToDelete, setMetodoToDelete] = useState<MetodoPago | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [paisFilter, setPaisFilter] = useState("todos");

  // Filtrar solo métodos de servicio
  const metodosConServicios = useMemo(() => {
    return metodosPago.filter((m) => m.asociadoA === "servicio");
  }, [metodosPago]);

  // Obtener países únicos
  const paisesUnicos = useMemo(() => {
    const paises = new Set(metodosConServicios.map((m) => m.pais));
    return Array.from(paises).filter(Boolean);
  }, [metodosConServicios]);

  // Filtrar y ordenar métodos de pago
  const filteredMetodos = useMemo(() => {
    const filtered = metodosConServicios.filter((metodo) => {
      const matchesSearch =
        metodo.nombre?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        metodo.titular?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        metodo.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        metodo.numeroTarjeta?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPais = paisFilter === "todos" || metodo.pais === paisFilter;
      return matchesSearch && matchesPais;
    });
    // Ordenar alfabéticamente por nombre
    return filtered.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [metodosConServicios, searchQuery, paisFilter]);

  
  const handleDelete = (metodo: MetodoPago) => {
    setMetodoToDelete(metodo);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (metodoToDelete) {
      try {
        await deleteMetodoPago(metodoToDelete.id);
        await fetchCounts(); // Actualizar métricas
        toast.success("Método de pago eliminado");
      } catch (error) {
        toast.error("Error al eliminar método de pago", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    }
  };

  const columns: Column<MetodoPago>[] = [
    {
      key: "nombre",
      header: "Método",
      sortable: true,
      width: "15%",
      render: (item) => (
        <span className="font-medium">{item.banco || item.nombre}</span>
      ),
    },
    {
      key: "pais",
      header: "País",
      sortable: true,
      align: "center",
      width: "12%",
    },
    {
      key: "titular",
      header: "Titular",
      sortable: true,
      align: "center",
      width: "18%",
    },
    {
      key: "email",
      header: "Email",
      sortable: false,
      align: "center",
      width: "20%",
      render: (item) => (
        <span className="text-sm">
          {item.email || item.identificador || "N/A"}
        </span>
      ),
    },
    {
      key: "numeroTarjeta",
      header: "Últimos Dígitos",
      sortable: false,
      align: "center",
      width: "13%",
      render: (item) => {
        if (item.numeroTarjeta) {
          // Extraer últimos 4 dígitos del número de tarjeta
          const digitos = item.numeroTarjeta.replace(/\D/g, "").slice(-4);
          return <span className="text-sm">{digitos}</span>;
        }
        return <span className="text-sm text-muted-foreground">N/A</span>;
      },
    },
    {
      key: "activo",
      header: "Estado",
      sortable: true,
      align: "center",
      width: "15%",
      render: (item) => (
        <Badge
          variant="outline"
          className={
            item.activo
              ? "text-xs border-green-500/50 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"
              : "text-xs border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
          }
        >
          {item.activo ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <Card className="p-4 pb-2">
        <h3 className="text-xl font-semibold">{title}</h3>
        <div className="dashboard-toolbar">
          <div className="dashboard-toolbar-search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por método, titular, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="dashboard-toolbar-control-wide justify-between font-normal"
              >
                <span className="min-w-0 truncate">
                  {paisFilter === "todos" ? "Todos los países" : paisFilter}
                </span>
                <svg
                  className="h-4 w-4 opacity-50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="dashboard-toolbar-menu">
              {[
                { value: "todos", label: "Todos los países" },
                ...paisesUnicos.map((p) => ({ value: p, label: p })),
              ].map((op) => (
                <DropdownMenuItem
                  key={op.value}
                  onClick={() => setPaisFilter(op.value)}
                  className="dashboard-toolbar-menu-item"
                >
                  <span className="dashboard-toolbar-menu-item-label">{op.label}</span>
                  {paisFilter === op.value && (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {filteredMetodos.length === 0 ? (
          <div className="border border-border rounded-md p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No se encontraron métodos de pago
            </p>
          </div>
        ) : (
          <DataTable
            data={filteredMetodos as unknown as Record<string, unknown>[]}
            columns={columns as unknown as Column<Record<string, unknown>>[]}
            pagination={true}
            itemsPerPageOptions={[10, 25, 50, 100]}
            actions={(item) => {
              const metodo = item as unknown as MetodoPago;
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link prefetch={false} href={`/metodos-pago/${metodo.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalles
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link prefetch={false} href={`/metodos-pago/${metodo.id}/editar`}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(metodo)}
                      className="text-red-500 focus:text-red-500"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }}
          />
        )}
      </Card>

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
