"use client";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getTerceroMetodoPagoNombre } from "@/lib/utils/terceroMetodoPago";
import type { MetodoPago, Tercero } from "@/types";

import { useTerceroFormController } from "./useTerceroFormController";

interface TerceroFormProps {
  usuario?: Tercero | null;
  tipoInicial?: "cliente" | "revendedor";
  metodosPago: MetodoPago[];
  onSuccess?: () => void;
  onCancel?: () => void;
  isPage?: boolean;
}

export function TerceroForm({
  usuario,
  tipoInicial = "cliente",
  metodosPago,
  onSuccess,
  onCancel,
  isPage = false,
}: TerceroFormProps) {
  const {
    activeTab,
    handleSubmit,
    handleNext,
    handlePrevious,
    handleTabChange,
    isPersonalTabComplete,
    register,
    setValue,
    errors,
    isSubmitting,
    tipoTerceroValue,
    metodoPagoIdValue,
    metodosPagoOrdenados,
    hasChanges,
    onSubmit,
  } = useTerceroFormController({
    usuario,
    tipoInicial,
    metodosPago,
    onSuccess,
  });
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={isPage ? "space-y-6" : "space-y-4"}
    >
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="mb-8 bg-transparent rounded-none p-0 h-auto inline-flex border-b border-border">
          <TabsTrigger
            value="personal"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
          >
            Información Personal
          </TabsTrigger>
          <TabsTrigger
            value="pago"
            className={`rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm ${
              !isPersonalTabComplete ? "cursor-not-allowed opacity-50" : ""
            }`}
          >
            Información de Pago
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-13">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                {...register("nombre")}
                placeholder="Juan"
                onChange={(e) => {
                  const value = e.target.value;
                  const capitalized =
                    value.charAt(0).toUpperCase() + value.slice(1);
                  setValue("nombre", capitalized);
                }}
              />
              {errors.nombre && (
                <p className="text-sm text-red-500">{errors.nombre.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="apellido">Apellido</Label>
              <Input
                id="apellido"
                {...register("apellido")}
                placeholder="Pérez"
                onChange={(e) => {
                  const value = e.target.value;
                  const capitalized =
                    value.charAt(0).toUpperCase() + value.slice(1);
                  setValue("apellido", capitalized);
                }}
              />
              {errors.apellido && (
                <p className="text-sm text-red-500">
                  {errors.apellido.message}
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="tipoTercero">Tipo de Tercero</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    type="button"
                  >
                    {tipoTerceroValue === "cliente"
                      ? "Cliente"
                      : tipoTerceroValue === "revendedor"
                        ? "Revendedor"
                        : "Seleccionar..."}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  <DropdownMenuItem
                    onClick={() => setValue("tipoTercero", "cliente")}
                  >
                    Cliente
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setValue("tipoTercero", "revendedor")}
                  >
                    Revendedor
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {errors.tipoTercero && (
                <p className="text-sm text-red-500">
                  {errors.tipoTercero.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                {...register("telefono")}
                placeholder="+507 6000-0000"
              />
              {errors.telefono && (
                <p className="text-sm text-red-500">
                  {errors.telefono.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleNext}>
              Siguiente
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="pago" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="metodoPagoId">Método de Pago</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    type="button"
                  >
                    {getTerceroMetodoPagoNombre(
                      metodoPagoIdValue,
                      metodosPagoOrdenados.find(
                        (m) => m.id === metodoPagoIdValue,
                      )?.nombre,
                    )}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  {metodosPagoOrdenados.map((metodo) => (
                    <DropdownMenuItem
                      key={metodo.id}
                      onClick={() => setValue("metodoPagoId", metodo.id)}
                    >
                      {metodo.nombre}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {errors.metodoPagoId && (
                <p className="text-sm text-red-500">
                  {errors.metodoPagoId.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              {...register("notas")}
              placeholder="Añade notas sobre el método de pago o el cliente..."
              rows={6}
            />
          </div>

          <div className="flex gap-3 justify-end pt-6">
            <Button type="button" variant="outline" onClick={handlePrevious}>
              Anterior
            </Button>
            <Button type="submit" disabled={isSubmitting || !hasChanges}>
              {isSubmitting
                ? usuario
                  ? "Guardando..."
                  : "Creando..."
                : usuario
                  ? "Guardar Cambios"
                  : "Crear Tercero"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </form>
  );
}
