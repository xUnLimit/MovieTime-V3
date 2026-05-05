"use client";

import { Usuario } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  User,
  MessageCircle,
  Monitor,
  Calendar,
  Clock,
  MoreHorizontal,
  RefreshCw,
  Copy,
  AlertTriangle,
  ShoppingCart,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useVentasUsuario } from "@/hooks/use-ventas-usuario";
import { getCurrencySymbol } from "@/lib/constants";
import { queryDocuments, ENTITIES } from "@/lib/supabase/repository";
import { formatearFecha, formatearFechaHora } from "@/lib/utils/calculations";
import { toast } from "sonner";
import { useVentasStore } from "@/store/ventasStore";
import { useServiciosStore } from "@/store/serviciosStore";
import { CambiarEstadoVentaDialog } from "./CambiarEstadoVentaDialog";
import { getUsuarioMetodoPagoNombre } from "@/lib/utils/usuarioMetodoPago";

interface UsuarioDetailsProps {
  usuario: Usuario;
}

export function UsuarioDetails({ usuario }: UsuarioDetailsProps) {
  const isRevendedor = usuario.tipo === "revendedor";
  const { ventas: ventasUsuario, renovacionesByServicio } = useVentasUsuario(
    usuario.id,
  );
  const [servicios, setServicios] = useState<
    Record<string, { correo: string; contrasena: string; nombre: string }>
  >({});
  const updateVenta = useVentasStore((s) => s.updateVenta);
  const updateServicio = useServiciosStore((s) => s.updateServicio);
  const [estadoDialog, setEstadoDialog] = useState<{
    open: boolean;
    modo: "activar" | "inactivar";
    venta: {
      id: string;
      servicioId: string;
      categoriaNombre: string;
      servicioNombre: string;
    } | null;
  }>({ open: false, modo: "activar", venta: null });

  const handleWhatsApp = () => {
    const phone = usuario.telefono.replace(/\D/g, "");
    window.open(`https://web.whatsapp.com/send?phone=${phone}`, "_blank");
  };

  const handleCopy = async (value: string, label?: string) => {
    if (!value || value === "—") return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label ? `${label} copiado` : "Copiado al portapapeles");
    } catch (error) {
      console.error("Error copiando:", error);
      toast.error("No se pudo copiar");
    }
  };

  // Query solo los servicios que el usuario tiene (en lugar de getAll)
  useEffect(() => {
    const servicioIds = Array.from(
      new Set(ventasUsuario.map((v) => v.servicioId).filter(Boolean)),
    );

    if (servicioIds.length === 0) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        // Chunks de 10 (limitación de 'in')
        const chunks: string[][] = [];
        for (let i = 0; i < servicioIds.length; i += 10) {
          chunks.push(servicioIds.slice(i, i + 10));
        }

        const allServicios = await Promise.all(
          chunks.map((chunk) =>
            queryDocuments<Record<string, unknown>>(ENTITIES.SERVICIOS, [
              { field: "__name__", operator: "in", value: chunk },
            ]),
          ),
        );

        if (cancelled) return;

        const serviciosMap = allServicios.flat().reduce(
          (acc, s) => {
            acc[s.id as string] = {
              correo: (s.correo as string) || "—",
              contrasena: (s.contrasena as string) || "—",
              nombre: (s.nombre as string) || "Servicio",
            };
            return acc;
          },
          {} as Record<
            string,
            { correo: string; contrasena: string; nombre: string }
          >,
        );

        setServicios(
          serviciosMap as Record<
            string,
            { correo: string; contrasena: string; nombre: string }
          >,
        );
      } catch (error) {
        console.error("Error cargando servicios:", error);
        if (!cancelled) setServicios({});
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [ventasUsuario]);

  const getCicloPagoLabel = (ciclo?: string) => {
    const labels: Record<string, string> = {
      mensual: "Mensual",
      trimestral: "Trimestral",
      semestral: "Semestral",
      anual: "Anual",
    };
    return ciclo ? labels[ciclo] || ciclo : "—";
  };

  const rows = useMemo(() => {
    const now = new Date();
    return ventasUsuario.map((venta) => {
      const servicio = servicios[venta.servicioId];

      const totalDias =
        venta.fechaInicio && venta.fechaFin
          ? Math.max(
              differenceInCalendarDays(venta.fechaFin, venta.fechaInicio),
              0,
            )
          : 0;
      const diasRestantes = venta.fechaFin
        ? differenceInCalendarDays(venta.fechaFin, now)
        : 0;
      const ratioRestante =
        totalDias > 0 ? Math.min(diasRestantes / totalDias, 1) : 0;
      const montoSinConsumir =
        totalDias > 0 ? Math.max(venta.precioFinal * ratioRestante, 0) : 0;

      return {
        id: venta.id,
        categoriaNombre: venta.categoriaNombre, // ← Denormalizado
        servicioNombre: servicio?.nombre || venta.servicioNombre,
        servicioId: venta.servicioId,
        correo:
          venta.servicioCorreo !== "—"
            ? venta.servicioCorreo
            : servicio?.correo || "—",
        contrasena: servicio?.contrasena || "—",
        cicloPago: getCicloPagoLabel(venta.cicloPago),
        fechaInicio: venta.fechaInicio,
        fechaFin: venta.fechaFin,
        montoSinConsumir,
        renovaciones: renovacionesByServicio[venta.id] ?? 0,
        diasRestantes,
        estado: venta.estado === "inactivo" ? "Inactivo" : "Activo",
        moneda: venta.moneda,
        perfilNumero: venta.perfilNumero,
      };
    });
  }, [ventasUsuario, servicios, renovacionesByServicio]);

  const handleCambiarEstado = async (alcance: "venta" | "venta_y_servicio") => {
    const { modo, venta } = estadoDialog;
    if (!venta) return;
    const nuevoEstadoVenta = modo === "activar" ? "activo" : "inactivo";
    const nuevoActivoServicio = modo === "activar";
    try {
      await updateVenta(venta.id, { estado: nuevoEstadoVenta });
      if (alcance === "venta_y_servicio") {
        await updateServicio(venta.servicioId, { activo: nuevoActivoServicio });
      }
      toast.success(
        modo === "activar"
          ? "Venta activada correctamente"
          : "Venta inactivada correctamente",
      );
    } catch {
      toast.error("Ocurrió un error al cambiar el estado");
      throw new Error("cambio estado fallido");
    }
  };

  const abrirDialogEstado = (
    modo: "activar" | "inactivar",
    row: (typeof rows)[number],
  ) => {
    setEstadoDialog({
      open: true,
      modo,
      venta: {
        id: row.id,
        servicioId: row.servicioId,
        categoriaNombre: row.categoriaNombre,
        servicioNombre: row.servicioNombre,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Layout de dos columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
        {/* Columna izquierda: Avatar y perfil */}
        <Card className="p-8">
          <div className="flex flex-col items-center space-y-6">
            {/* Avatar */}
            <div className="w-40 h-40 rounded-full bg-sidebar flex items-center justify-center">
              <User className="w-20 h-20 text-sidebar-foreground" />
            </div>

            {/* Nombre y tipo */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">
                {usuario.nombre} {usuario.apellido}
              </h2>
              <Badge variant="outline" className="text-sm">
                {isRevendedor ? "Revendedor" : "Cliente"}
              </Badge>
            </div>

            {/* Botón de WhatsApp */}
            <Button
              onClick={handleWhatsApp}
              className="w-full bg-green-700 hover:bg-green-800 text-white"
              size="lg"
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Contactar por WhatsApp
            </Button>
          </div>
        </Card>

        {/* Columna derecha: Información */}
        <div className="space-y-6">
          {/* Información de Contacto */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold leading-none mb-3">
              Información de Contacto
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Teléfono</p>
                <p className="text-sm font-medium">{usuario.telefono}</p>
              </div>
              {usuario.email && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Email</p>
                  <p className="text-sm font-medium">{usuario.email}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Información Adicional */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold leading-none mb-3">
              Información Adicional
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Método de Pago
                </p>
                <p className="text-sm font-medium">
                  {getUsuarioMetodoPagoNombre(
                    usuario.metodoPagoId,
                    usuario.metodoPagoNombre,
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Cliente desde
                </p>
                <p className="text-sm font-medium">
                  {formatearFechaHora(new Date(usuario.createdAt))}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Última actualización
                </p>
                <p className="text-sm font-medium">
                  {formatearFechaHora(new Date(usuario.updatedAt))}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-1">Notas</p>
              <p className={`text-sm whitespace-pre-wrap ${usuario.notas?.trim() ? "text-foreground" : "text-muted-foreground italic"}`}>
                {usuario.notas?.trim() || "No hay notas."}
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Servicios Asociados */}
      <Card className="p-6">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold leading-none">
            Servicios Asociados
          </h3>
          <p className="text-sm text-muted-foreground leading-none">
            Lista de servicios y perfiles que este usuario tiene o ha tenido.
          </p>
        </div>
        {rows.length === 0 ? (
          <div className="mt-4 text-center py-8 text-muted-foreground">
            <p>No hay servicios asociados a este usuario.</p>
          </div>
        ) : (
          <div className="mt-4 rounded-md border bg-background overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-muted-foreground">
                    Categoría
                  </TableHead>
                  <TableHead className="text-muted-foreground">Email</TableHead>
                  <TableHead className="text-center text-muted-foreground">
                    Contraseña
                  </TableHead>
                  <TableHead className="text-center text-muted-foreground">
                    Ciclo de Pago
                  </TableHead>
                  <TableHead className="text-center text-muted-foreground">
                    Fecha de Inicio
                  </TableHead>
                  <TableHead className="text-center text-muted-foreground">
                    Fecha de Expiración
                  </TableHead>
                  <TableHead className="text-center text-muted-foreground">
                    Monto Sin Consumir
                  </TableHead>
                  <TableHead className="text-center text-muted-foreground">
                    Renovaciones
                  </TableHead>
                  <TableHead className="text-center text-muted-foreground">
                    Días Restantes
                  </TableHead>
                  <TableHead className="text-center text-muted-foreground">
                    Estado
                  </TableHead>
                  <TableHead className="text-center text-muted-foreground">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Monitor
                          className={`h-4 w-4 ${row.estado === "Inactivo" ? "text-red-500" : "text-green-500"}`}
                        />
                        <div>
                          <p className="font-medium">{row.categoriaNombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.servicioNombre}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex items-center gap-2">
                        <span className="font-medium">{row.correo}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleCopy(row.correo, "Correo")}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex w-full items-center justify-center gap-2">
                        <span className="font-medium">{row.contrasena}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            handleCopy(row.contrasena, "Contraseña")
                          }
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{row.cicloPago}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {row.fechaInicio
                            ? formatearFecha(row.fechaInicio)
                            : "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {row.fechaFin ? formatearFecha(row.fechaFin) : "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      <span
                        className={
                          row.estado === "Inactivo"
                            ? "text-muted-foreground"
                            : "text-green-500"
                        }
                      >
                        {getCurrencySymbol(row.moneda)}
                      </span>
                      <span
                        className={
                          row.estado === "Inactivo"
                            ? "text-muted-foreground"
                            : "text-foreground"
                        }
                      >
                        {" "}
                        {row.montoSinConsumir.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center gap-1 font-medium">
                        <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                        {row.renovaciones}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {row.estado === "Inactivo" ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : row.diasRestantes < 0 ? (
                        <Badge
                          variant="outline"
                          className="border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 gap-1"
                        >
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          {Math.abs(row.diasRestantes)} día
                          {Math.abs(row.diasRestantes) !== 1 ? "s" : ""} de
                          retraso
                        </Badge>
                      ) : row.diasRestantes === 0 ? (
                        <Badge
                          variant="outline"
                          className="border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                        >
                          Vence hoy
                        </Badge>
                      ) : row.diasRestantes <= 7 ? (
                        <Badge
                          variant="outline"
                          className="border-yellow-500/50 bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300"
                        >
                          {row.diasRestantes} día
                          {row.diasRestantes !== 1 ? "s" : ""} restante
                          {row.diasRestantes !== 1 ? "s" : ""}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-green-500/50 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"
                        >
                          {row.diasRestantes} días restantes
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          row.estado === "Activo"
                            ? "border-green-500/50 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"
                            : "border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                        }
                      >
                        {row.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/ventas/${row.id}`}>
                              <ShoppingCart className="h-4 w-4 mr-2" />
                              Ver Venta
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/servicios/detalle/${row.servicioId}`}>
                              <Monitor className="h-4 w-4 mr-2" />
                              Ver Servicio
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => abrirDialogEstado("activar", row)}
                          >
                            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                            <span className="text-green-600">Activar</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => abrirDialogEstado("inactivar", row)}
                          >
                            <XCircle className="h-4 w-4 mr-2 text-red-600" />
                            <span className="text-red-600">Inactivar</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <CambiarEstadoVentaDialog
        open={estadoDialog.open}
        onOpenChange={(open) => setEstadoDialog((prev) => ({ ...prev, open }))}
        modo={estadoDialog.modo}
        venta={estadoDialog.venta}
        onConfirm={handleCambiarEstado}
      />
    </div>
  );
}
