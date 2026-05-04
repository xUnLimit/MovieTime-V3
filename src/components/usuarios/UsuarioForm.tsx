"use client";

import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Usuario, MetodoPago } from "@/types";
import { useUsuariosStore } from "@/store/usuariosStore";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import {
  createPendingUserPaymentMethod,
  getUsuarioMetodoPagoNombre,
  getUsuarioMetodoPagoMoneda,
  isPendingUserPaymentMethodId,
  PENDING_USER_PAYMENT_ID,
  PENDING_USER_PAYMENT_NAME,
} from "@/lib/utils/usuarioMetodoPago";

const usuarioSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  apellido: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
  tipoUsuario: z.enum(["cliente", "revendedor"], {
    message: "Debe seleccionar un tipo de usuario",
  }),
  telefono: z.string().min(8, "El teléfono debe tener al menos 8 dígitos"),
  metodoPagoId: z.string().min(1, "El método de pago es requerido"),
  notas: z.string().optional(),
});

type UsuarioFormData = z.infer<typeof usuarioSchema>;

/**
 * Formatea un teléfono al guardar:
 * - "66894143" o "6689-4143" → "+507 6689-4143"
 * - "+91 12345678" → "+91 1234-5678" (respeta código de país)
 * - "+507 6689-4143" → sin cambios
 */
function formatearTelefono(raw: string): string {
  const trimmed = raw.trim();
  // Si ya tiene código de país (+...), extraer código y número local
  if (trimmed.startsWith("+")) {
    const sinPlus = trimmed.slice(1);
    const digits = sinPlus.replace(/\D/g, "");
    // Si tiene más de 8 dígitos, los últimos 8 son el número local
    if (digits.length > 8) {
      const countryCode = digits.slice(0, digits.length - 8);
      const local = digits.slice(digits.length - 8);
      return "+" + countryCode + " " + local.slice(0, 4) + "-" + local.slice(4);
    }
    // Si tiene 8 o menos después del +, devolver tal cual formateado
    return trimmed;
  }
  // Sin código de país: extraer solo dígitos y asumir Panamá (+507)
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 8) {
    return "+507 " + digits.slice(0, 4) + "-" + digits.slice(4);
  }
  // Si no son exactamente 8 dígitos, devolver lo que escribió sin modificar
  return trimmed;
}

interface UsuarioFormProps {
  usuario?: Usuario | null;
  tipoInicial?: "cliente" | "revendedor";
  metodosPago: MetodoPago[];
  onSuccess?: () => void;
  onCancel?: () => void;
  isPage?: boolean;
}

export function UsuarioForm({
  usuario,
  tipoInicial = "cliente",
  metodosPago,
  onSuccess,
  onCancel,
  isPage = false,
}: UsuarioFormProps) {
  const { createUsuario, updateUsuario } = useUsuariosStore();
  const pendienteOption = useMemo<MetodoPago>(
    () => createPendingUserPaymentMethod(),
    [],
  );
  const [activeTab, setActiveTab] = useState("personal");
  const [isPersonalTabComplete, setIsPersonalTabComplete] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    trigger,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<UsuarioFormData>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: {
      nombre: "",
      apellido: "",
      tipoUsuario: "" as "cliente" | "revendedor",
      telefono: "",
      metodoPagoId: PENDING_USER_PAYMENT_ID,
      notas: "",
    },
  });

  const tipoUsuarioValue = watch("tipoUsuario");
  const metodoPagoIdValue = watch("metodoPagoId");
  const nombreValue = watch("nombre");
  const apellidoValue = watch("apellido");
  const telefonoValue = watch("telefono");
  const metodosPagoOrdenados = useMemo(
    () => [
      pendienteOption,
      ...metodosPago
        .filter((metodo) => metodo.asociadoA === "usuario" || !metodo.asociadoA)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    ],
    [metodosPago, pendienteOption],
  );

  // Detectar si hay cambios en el formulario (solo en modo edición)
  const hasChanges = useMemo(() => {
    if (!usuario) return true; // En modo creación, siempre permitir guardar

    const usuarioMetodoPagoId = isPendingUserPaymentMethodId(
      usuario.metodoPagoId,
    )
      ? PENDING_USER_PAYMENT_ID
      : usuario.metodoPagoId;

    return (
      nombreValue !== (usuario.nombre || "") ||
      apellidoValue !== (usuario.apellido || "") ||
      tipoUsuarioValue !== usuario.tipo ||
      telefonoValue !== usuario.telefono ||
      metodoPagoIdValue !== usuarioMetodoPagoId
    );
  }, [
    usuario,
    nombreValue,
    apellidoValue,
    tipoUsuarioValue,
    telefonoValue,
    metodoPagoIdValue,
  ]);

  // Limpiar errores cuando los campos se corrijan
  useEffect(() => {
    if (nombreValue && nombreValue.length >= 2 && errors.nombre) {
      clearErrors("nombre");
    }
  }, [nombreValue, errors.nombre, clearErrors]);

  useEffect(() => {
    if (apellidoValue && apellidoValue.length >= 2 && errors.apellido) {
      clearErrors("apellido");
    }
  }, [apellidoValue, errors.apellido, clearErrors]);

  useEffect(() => {
    if (tipoUsuarioValue && errors.tipoUsuario) {
      clearErrors("tipoUsuario");
    }
  }, [tipoUsuarioValue, errors.tipoUsuario, clearErrors]);

  useEffect(() => {
    if (telefonoValue && telefonoValue.length >= 8 && errors.telefono) {
      clearErrors("telefono");
    }
  }, [telefonoValue, errors.telefono, clearErrors]);

  useEffect(() => {
    if (usuario) {
      reset({
        nombre: usuario.nombre || "",
        apellido: usuario.apellido || "",
        tipoUsuario: usuario.tipo,
        telefono: usuario.telefono,
        metodoPagoId: isPendingUserPaymentMethodId(usuario.metodoPagoId)
          ? PENDING_USER_PAYMENT_ID
          : usuario.metodoPagoId,
        notas: "",
      });
    } else {
      reset({
        nombre: "",
        apellido: "",
        tipoUsuario: tipoInicial as "cliente" | "revendedor",
        telefono: "",
        metodoPagoId: PENDING_USER_PAYMENT_ID,
        notas: "",
      });
    }
  }, [usuario, tipoInicial, reset]);

  const handleNext = async () => {
    // Validar campos de la pestaña personal
    const isValid = await trigger([
      "nombre",
      "apellido",
      "tipoUsuario",
      "telefono",
    ]);
    if (isValid) {
      setIsPersonalTabComplete(true);
      setActiveTab("pago");
    }
  };

  const handlePrevious = () => {
    setActiveTab("personal");
  };

  const onSubmit = async (data: UsuarioFormData) => {
    try {
      const metodoPago = isPendingUserPaymentMethodId(data.metodoPagoId)
        ? null
        : metodosPago.find((m) => m.id === data.metodoPagoId);

      const telefonoFormateado = formatearTelefono(data.telefono);

      const usuarioData = {
        nombre: data.nombre,
        apellido: data.apellido,
        tipo: data.tipoUsuario,
        telefono: telefonoFormateado,
        metodoPagoId: data.metodoPagoId,
        metodoPagoNombre: metodoPago?.nombre || PENDING_USER_PAYMENT_NAME,
        moneda: getUsuarioMetodoPagoMoneda(
          data.metodoPagoId,
          metodoPago?.moneda,
        ),
        active: true,
        createdBy: "current-user",
      };

      if (usuario) {
        // Actualizar usuario existente (incluyendo cambio de tipo si es necesario)
        await updateUsuario(usuario.id, usuarioData);
        const cambioTipo = usuario.tipo !== data.tipoUsuario;
        toast.success(
          cambioTipo
            ? "Tipo de usuario actualizado"
            : `${data.tipoUsuario === "cliente" ? "Cliente" : "Revendedor"} actualizado`,
          {
            description: cambioTipo
              ? `El usuario ha sido convertido a ${data.tipoUsuario} correctamente.`
              : "Los datos del usuario han sido actualizados correctamente.",
          },
        );
      } else {
        // Crear nuevo usuario
        await createUsuario(usuarioData);
        toast.success(
          `${data.tipoUsuario === "cliente" ? "Cliente" : "Revendedor"} creado`,
          {
            description: `El nuevo ${data.tipoUsuario} ha sido registrado correctamente en el sistema.`,
          },
        );
      }

      onSuccess?.();
    } catch (error) {
      toast.error("Error al guardar usuario", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleTabChange = async (value: string) => {
    if (value === "pago" && !isPersonalTabComplete) {
      const isValid = await trigger([
        "nombre",
        "apellido",
        "tipoUsuario",
        "telefono",
      ]);
      if (isValid) {
        setIsPersonalTabComplete(true);
        setActiveTab(value);
      }
    } else {
      setActiveTab(value);
    }
  };

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
              <Label htmlFor="tipoUsuario">Tipo de Usuario</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    type="button"
                  >
                    {tipoUsuarioValue === "cliente"
                      ? "Cliente"
                      : tipoUsuarioValue === "revendedor"
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
                    onClick={() => setValue("tipoUsuario", "cliente")}
                  >
                    Cliente
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setValue("tipoUsuario", "revendedor")}
                  >
                    Revendedor
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {errors.tipoUsuario && (
                <p className="text-sm text-red-500">
                  {errors.tipoUsuario.message}
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
                    {getUsuarioMetodoPagoNombre(
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
                  : "Crear Usuario"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </form>
  );
}
