"use client";

import { MessageCircle, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatearFechaHora } from "@/lib/utils/calculations";
import { getTerceroMetodoPagoNombre } from "@/lib/utils/terceroMetodoPago";
import type { Tercero } from "@/types";

import { CambiarEstadoVentaDialog } from "./CambiarEstadoVentaDialog";
import { TerceroVentasTabs } from "./TerceroVentasTabs";
import { useTerceroDetailsController } from "./useTerceroDetailsController";

interface TerceroDetailsProps {
  usuario: Tercero;
}

export function TerceroDetails({ usuario }: TerceroDetailsProps) {
  const {
    isRevendedor,
    activeRows,
    inactiveRows,
    estadoDialog,
    setEstadoDialog,
    handleWhatsApp,
    handleCopy,
    abrirDialogEstado,
    handleCambiarEstado,
  } = useTerceroDetailsController(usuario);
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
                  {getTerceroMetodoPagoNombre(
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

      <TerceroVentasTabs
        activeRows={activeRows}
        inactiveRows={inactiveRows}
        onCopy={handleCopy}
        onOpenEstadoDialog={abrirDialogEstado}
      />
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
