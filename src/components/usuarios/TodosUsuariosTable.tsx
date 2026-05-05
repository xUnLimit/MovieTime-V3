"use client";

import { useMemo, useState } from "react";
import { Usuario } from "@/types";
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
import {
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  MessageCircle,
  Monitor,
  Eye,
} from "lucide-react";
import { useUsuariosStore } from "@/store/usuariosStore";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  PaginationFooter,
  PaginationFooterProps,
} from "@/components/shared/PaginationFooter";
import { toast } from "sonner";
import { useVentasPorUsuarios } from "@/hooks/use-ventas-por-usuarios";
import { getUsuarioMetodoPagoNombre } from "@/lib/utils/usuarioMetodoPago";
import Link from "next/link";

interface UsuarioDisplay extends Record<string, unknown> {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string;
  metodoPagoNombre: string;
  tipo: "Cliente" | "Revendedor";
  serviciosActivos: number;
  montoSinConsumir: number;
  original: Usuario;
}

interface MetodoPagoFilterOption {
  value: string;
  label: string;
}

interface TodosUsuariosTableProps {
  usuarios: Usuario[];
  onEdit: (usuario: Usuario) => void;
  onView?: (usuario: Usuario) => void;
  title?: string;
  isLoading?: boolean;
  pagination?: PaginationFooterProps;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  metodoPagoFilter: string;
  onMetodoPagoFilterChange: (value: string) => void;
  metodoPagoOptions: MetodoPagoFilterOption[];
}

export function TodosUsuariosTable({
  usuarios,
  onView,
  title = "Todos los usuarios",
  isLoading = false,
  pagination,
  searchQuery,
  onSearchChange,
  onRefresh,
  metodoPagoFilter,
  onMetodoPagoFilterChange,
  metodoPagoOptions,
}: TodosUsuariosTableProps) {
  const { deleteUsuario } = useUsuariosStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [usuarioToDelete, setUsuarioToDelete] = useState<UsuarioDisplay | null>(
    null,
  );

  const usuarioIds = useMemo(() => usuarios.map((u) => u.id), [usuarios]);
  const { stats: ventasPorUsuario } = useVentasPorUsuarios(usuarioIds, {
    enabled: !isLoading,
  });

  const usuariosDisplay: UsuarioDisplay[] = useMemo(() => {
    return usuarios.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      apellido: u.apellido,
      telefono: u.telefono,
      metodoPagoNombre: getUsuarioMetodoPagoNombre(
        u.metodoPagoId,
        u.metodoPagoNombre,
      ),
      tipo: u.tipo === "cliente" ? "Cliente" : "Revendedor",
      serviciosActivos: u.serviciosActivos ?? 0,
      montoSinConsumir: ventasPorUsuario[u.id]?.montoSinConsumir ?? 0,
      original: u,
    }));
  }, [usuarios, ventasPorUsuario]);

  const selectedMetodoPagoLabel =
    metodoPagoOptions.find((option) => option.value === metodoPagoFilter)
      ?.label ?? "Todos los métodos";

  const handleDelete = (usuario: UsuarioDisplay) => {
    setUsuarioToDelete(usuario);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (usuarioToDelete) {
      try {
        await deleteUsuario(usuarioToDelete.original.id, {
          tipo: usuarioToDelete.original.tipo,
          nombre: usuarioToDelete.original.nombre,
          createdAt: usuarioToDelete.original.createdAt,
          serviciosActivos: usuarioToDelete.original.serviciosActivos,
        });
        toast.success(`${usuarioToDelete.tipo} eliminado`, {
          description:
            "El usuario ha sido eliminado correctamente del sistema.",
        });
        setDeleteDialogOpen(false);
        setUsuarioToDelete(null);
        onRefresh();
      } catch (error) {
        toast.error(`Error al eliminar ${usuarioToDelete.tipo.toLowerCase()}`, {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    }
  };

  
  
  const handleWhatsApp = (usuario: UsuarioDisplay) => {
    const phone = usuario.telefono.replace(/\D/g, "");
    window.open(`https://web.whatsapp.com/send?phone=${phone}`, "_blank");
  };

  const columns: Column<UsuarioDisplay>[] = [
    {
      key: "nombre",
      header: "Nombre",
      sortable: true,
      width: "14%",
      render: (item) => (
        <div className="font-medium">
          {item.nombre} {item.apellido}
        </div>
      ),
    },
    {
      key: "tipo",
      header: "Tipo",
      sortable: false,
      align: "center",
      width: "16%",
      render: (item) => <span>{item.tipo}</span>,
    },
    {
      key: "metodoPagoNombre",
      header: "Método de Pago",
      sortable: false,
      align: "center",
      width: "16%",
    },
    {
      key: "serviciosActivos",
      header: "Servicios Activos",
      sortable: true,
      align: "center",
      width: "16%",
      render: (item) => {
        const isActive = item.serviciosActivos > 0;
        return (
          <div className="flex items-center justify-center gap-2">
            <Monitor
              className={`h-4 w-4 ${isActive ? "text-green-500" : "text-muted-foreground"}`}
            />
            <span className={isActive ? "" : "text-muted-foreground"}>
              {item.serviciosActivos}
            </span>
          </div>
        );
      },
    },
    {
      key: "montoSinConsumir",
      header: "Monto Sin Consumir",
      sortable: true,
      align: "center",
      width: "16%",
      render: (item) => {
        const isActive = item.serviciosActivos > 0;
        return (
          <div className="flex items-center justify-center gap-1">
            <span
              className={
                isActive
                  ? "text-green-500 font-medium"
                  : "text-muted-foreground"
              }
            >
              $
            </span>
            <span
              className={isActive ? "font-medium" : "text-muted-foreground"}
            >
              {item.montoSinConsumir.toFixed(2)}
            </span>
          </div>
        );
      },
    },
    {
      key: "contacto",
      header: "Contacto",
      align: "center",
      width: "16%",
      render: (item) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleWhatsApp(item);
          }}
          className="text-green-500 hover:text-green-400 p-0 h-auto"
        >
          <MessageCircle className="h-4 w-4 mr-1" />
          WhatsApp
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card className="p-4 pb-2">
        <h3 className="text-xl font-semibold">{title}</h3>
        <div className="flex items-center gap-4 -mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o teléfono..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-[180px] justify-between font-normal"
              >
                {selectedMetodoPagoLabel}
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
            <DropdownMenuContent align="end" className="w-[180px]">
              {metodoPagoOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => onMetodoPagoFilterChange(option.value)}
                  className="flex items-center justify-between"
                >
                  {option.label}
                  {metodoPagoFilter === option.value && (
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

        <DataTable<UsuarioDisplay>
          data={usuariosDisplay}
          columns={columns}
          loading={isLoading}
          pagination={false}
          actions={(item) => {
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onView && (
                    <DropdownMenuItem asChild>
                      <Link href={`/usuarios/${item.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalles
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href={`/usuarios/editar/${item.id}`}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDelete(item)}
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
        {pagination && <PaginationFooter {...pagination} />}
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title={`Eliminar ${usuarioToDelete?.tipo || "Usuario"}`}
        description={`¿Estás seguro de que quieres eliminar a "${usuarioToDelete?.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      />
    </>
  );
}
