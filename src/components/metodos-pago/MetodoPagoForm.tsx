"use client";

import { useEffect, useState, useMemo } from "react";
import { FieldErrors, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ChevronDown, Search } from "lucide-react";
import { useMetodosPagoStore } from "@/store/metodosPagoStore";
import { useRouter } from "next/navigation";
import { MetodoPago } from "@/types";

// Schema completo con todos los campos
const metodoPagoSchemaComplete = z
  .object({
    nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    asociadoA: z.enum(["usuario", "servicio"] as const, {
      message: "Debe seleccionar asociado a",
    }),
    pais: z.string().min(2, "El paÃ­s es requerido"),
    moneda: z.string().min(2, "La moneda es requerida"),
    alias: z.string().optional(),
    titular: z.string().min(2, "El titular es requerido"),
    notas: z.string().optional(),
    // Campos para usuario
    tipoCuenta: z
      .enum(["ahorro", "corriente", "wallet", "telefono", "email"] as const)
      .optional(),
    identificador: z.string().optional(),
    // Campos para servicio
    email: z.string().optional(),
    contrasena: z.string().optional(),
    numeroTarjeta: z.string().optional(),
    fechaExpiracion: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.asociadoA === "usuario") {
      if (!data.tipoCuenta) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Debe seleccionar un tipo de cuenta",
          path: ["tipoCuenta"],
        });
      }
      if (!data.identificador || data.identificador.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El identificador es requerido",
          path: ["identificador"],
        });
      }
    } else if (data.asociadoA === "servicio") {
      if (!data.numeroTarjeta || data.numeroTarjeta.length < 19) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "NÃºmero de tarjeta invÃ¡lido (mÃ­nimo 16 dÃ­gitos)",
          path: ["numeroTarjeta"],
        });
      } else if (data.numeroTarjeta.length > 24) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "NÃºmero de tarjeta invÃ¡lido (mÃ¡ximo 19 dÃ­gitos)",
          path: ["numeroTarjeta"],
        });
      }

      if (!data.fechaExpiracion || data.fechaExpiracion.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La fecha de expiraciÃ³n es requerida",
          path: ["fechaExpiracion"],
        });
      } else if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(data.fechaExpiracion)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Formato invÃ¡lido (MM/YY)",
          path: ["fechaExpiracion"],
        });
      }
    }
  });

type FormData = z.infer<typeof metodoPagoSchemaComplete>;

// Lista de paÃ­ses con sus monedas
const PAISES_MONEDAS = [
  { pais: "PanamÃ¡", moneda: "USD" },
  { pais: "Argentina", moneda: "ARS" },
  { pais: "Chile", moneda: "CLP" },
  { pais: "Colombia", moneda: "COP" },
  { pais: "Costa Rica", moneda: "CRC" },
  { pais: "Ecuador", moneda: "USD" },
  { pais: "Egipto", moneda: "EGP" },
  { pais: "EspaÃ±a", moneda: "EUR" },
  { pais: "Estados Unidos", moneda: "USD" },
  { pais: "MÃ©xico", moneda: "MXN" },
  { pais: "Nigeria", moneda: "NGN" },
  { pais: "PerÃº", moneda: "PEN" },
  { pais: "TurquÃ­a", moneda: "TRY" },
  { pais: "Venezuela", moneda: "VES" },
];

const MONEDAS = [
  "USD",
  "EUR",
  "COP",
  "MXN",
  "CRC",
  "VES",
  "ARS",
  "CLP",
  "PEN",
  "NGN",
  "TRY",
  "EGP",
];

interface MetodoPagoFormProps {
  mode: "create" | "edit";
  metodoPago?: MetodoPago;
  returnTo?: string;
}

export function MetodoPagoForm({
  mode,
  metodoPago,
  returnTo = "/metodos-pago",
}: MetodoPagoFormProps) {
  const router = useRouter();
  const { createMetodoPago, updateMetodoPago, fetchCounts } =
    useMetodosPagoStore();
  const [activeTab, setActiveTab] = useState("basica");
  const [paisSearch, setPaisSearch] = useState("");
  const [isBasicaTabComplete, setIsBasicaTabComplete] = useState(
    mode === "edit",
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    clearErrors,
    trigger,
  } = useForm<FormData>({
    resolver: zodResolver(metodoPagoSchemaComplete),
    defaultValues:
      mode === "edit" && metodoPago
        ? {
            nombre: metodoPago.nombre,
            asociadoA:
              metodoPago.asociadoA ||
              ((!metodoPago.tipoCuenta ? "servicio" : "usuario") as
                | "servicio"
                | "usuario"),
            pais: metodoPago.pais,
            moneda: "USD",
            alias: "",
            titular: metodoPago.titular,
            tipoCuenta:
              metodoPago.tipoCuenta &&
              ["ahorro", "corriente", "wallet", "telefono", "email"].includes(
                metodoPago.tipoCuenta,
              )
                ? (metodoPago.tipoCuenta as
                    | "ahorro"
                    | "corriente"
                    | "wallet"
                    | "telefono"
                    | "email"
                    | undefined)
                : undefined,
            identificador: metodoPago.identificador,
            email: metodoPago.email || "",
            contrasena: metodoPago.contrasena || "",
            numeroTarjeta: metodoPago.numeroTarjeta || "",
            fechaExpiracion: metodoPago.fechaExpiracion || "",
            notas: "",
          }
        : {
            nombre: "",
            asociadoA: undefined as "servicio" | "usuario" | undefined,
            pais: "",
            moneda: "",
            alias: "",
            titular: "",
            tipoCuenta: undefined as
              | "ahorro"
              | "corriente"
              | "wallet"
              | "telefono"
              | "email"
              | undefined,
            identificador: "",
            email: "",
            contrasena: "",
            numeroTarjeta: "",
            fechaExpiracion: "",
            notas: "",
          },
  });

  const nombreValue = watch("nombre");
  const asociadoAValue = watch("asociadoA");
  const paisValue = watch("pais");
  const monedaValue = watch("moneda");
  const aliasValue = watch("alias");
  const titularValue = watch("titular");
  const tipoCuentaValue = watch("tipoCuenta");
  const identificadorValue = watch("identificador");
  const emailValue = watch("email");
  const contrasenaValue = watch("contrasena");
  const numeroTarjetaValue = watch("numeroTarjeta");
  const fechaExpiracionValue = watch("fechaExpiracion");
  const notasValue = watch("notas");

  const hasChanges = useMemo(() => {
    if (mode !== "edit" || !metodoPago) return true;
    if (nombreValue !== metodoPago.nombre) return true;
    if (paisValue !== metodoPago.pais) return true;
    if (monedaValue !== (metodoPago.moneda || "USD")) return true;
    if (titularValue !== metodoPago.titular) return true;
    if (
      asociadoAValue !==
      (metodoPago.asociadoA ||
        (!metodoPago.tipoCuenta ? "servicio" : "usuario"))
    )
      return true;
    if ((aliasValue || "") !== (metodoPago.alias || "")) return true;
    if ((notasValue || "") !== (metodoPago.notas || "")) return true;
    if (asociadoAValue === "usuario") {
      if (tipoCuentaValue !== metodoPago.tipoCuenta) return true;
      if (identificadorValue !== metodoPago.identificador) return true;
    } else if (asociadoAValue === "servicio") {
      if (emailValue !== (metodoPago.email || "")) return true;
      if (contrasenaValue !== (metodoPago.contrasena || "")) return true;
      if (numeroTarjetaValue !== (metodoPago.numeroTarjeta || "")) return true;
      if (fechaExpiracionValue !== (metodoPago.fechaExpiracion || ""))
        return true;
    }
    return false;
  }, [
    mode,
    metodoPago,
    nombreValue,
    asociadoAValue,
    paisValue,
    monedaValue,
    aliasValue,
    titularValue,
    tipoCuentaValue,
    identificadorValue,
    emailValue,
    contrasenaValue,
    numeroTarjetaValue,
    fechaExpiracionValue,
    notasValue,
  ]);

  // Auto-limpiar errores - Tab BÃ¡sica
  useEffect(() => {
    if (nombreValue && nombreValue.length >= 2 && errors.nombre) {
      clearErrors("nombre");
    }
  }, [nombreValue, errors.nombre, clearErrors]);

  useEffect(() => {
    if (asociadoAValue && errors.asociadoA) {
      clearErrors("asociadoA");
    }
  }, [asociadoAValue, errors.asociadoA, clearErrors]);

  useEffect(() => {
    if (paisValue && paisValue.length >= 2 && errors.pais) {
      clearErrors("pais");
    }
  }, [paisValue, errors.pais, clearErrors]);

  useEffect(() => {
    if (monedaValue && monedaValue.length >= 2 && errors.moneda) {
      clearErrors("moneda");
    }
  }, [monedaValue, errors.moneda, clearErrors]);

  // Auto-limpiar errores - Tab Adicional (Usuario)
  useEffect(() => {
    if (titularValue && titularValue.length >= 2 && errors.titular) {
      clearErrors("titular");
    }
  }, [titularValue, errors.titular, clearErrors]);

  useEffect(() => {
    if (tipoCuentaValue && errors.tipoCuenta) {
      clearErrors("tipoCuenta");
    }
  }, [tipoCuentaValue, errors.tipoCuenta, clearErrors]);

  useEffect(() => {
    if (
      identificadorValue &&
      identificadorValue.length >= 2 &&
      errors.identificador
    ) {
      clearErrors("identificador");
    }
  }, [identificadorValue, errors.identificador, clearErrors]);

  // Auto-limpiar errores - Tab Adicional (Servicio)
  useEffect(() => {
    if (emailValue && errors.email) {
      clearErrors("email");
    }
  }, [emailValue, errors.email, clearErrors]);

  useEffect(() => {
    if (contrasenaValue && contrasenaValue.length >= 6 && errors.contrasena) {
      clearErrors("contrasena");
    }
  }, [contrasenaValue, errors.contrasena, clearErrors]);

  useEffect(() => {
    if (
      numeroTarjetaValue &&
      numeroTarjetaValue.replace(/\s/g, "").length >= 16 &&
      errors.numeroTarjeta
    ) {
      clearErrors("numeroTarjeta");
    }
  }, [numeroTarjetaValue, errors.numeroTarjeta, clearErrors]);

  useEffect(() => {
    if (
      fechaExpiracionValue &&
      /^(0[1-9]|1[0-2])\/\d{2}$/.test(fechaExpiracionValue) &&
      errors.fechaExpiracion
    ) {
      clearErrors("fechaExpiracion");
    }
  }, [fechaExpiracionValue, errors.fechaExpiracion, clearErrors]);

  // Auto-set moneda when pais changes
  useEffect(() => {
    if (paisValue) {
      const paisMoneda = PAISES_MONEDAS.find((pm) => pm.pais === paisValue);
      if (paisMoneda) {
        setValue("moneda", paisMoneda.moneda);
      }
    }
  }, [paisValue, setValue]);

  // ValidaciÃ³n entre tabs
  const handleTabChange = async (value: string) => {
    if (value === "adicional" && !isBasicaTabComplete) {
      const isValid = await trigger(["nombre", "asociadoA", "pais", "moneda"]);
      if (isValid) {
        setIsBasicaTabComplete(true);
        setActiveTab(value);
      }
    } else {
      setActiveTab(value);
    }
  };

  const handleNext = async () => {
    const isValid = await trigger(["nombre", "asociadoA", "pais", "moneda"]);
    if (isValid) {
      setIsBasicaTabComplete(true);
      setActiveTab("adicional");
    }
  };

  const handlePrevious = () => {
    setActiveTab("basica");
  };

  const onSubmit = async (data: FormData) => {
    try {
      if (mode === "create") {
        const metodoPagoData: Omit<
          MetodoPago,
          "id" | "createdAt" | "updatedAt"
        > = {
          nombre: data.nombre,
          pais: data.pais,
          moneda: data.moneda,
          titular: data.titular,
          activo: true,
          asociadoA: data.asociadoA,
          tipo: "banco",
          identificador: data.identificador || data.email || "",
        };
        if (data.alias) metodoPagoData.alias = data.alias;
        if (data.notas) metodoPagoData.notas = data.notas;
        if (data.asociadoA === "usuario" && data.tipoCuenta) {
          metodoPagoData.identificador = data.identificador || "";
          metodoPagoData.tipoCuenta = data.tipoCuenta;
        } else if (data.asociadoA === "servicio") {
          if (data.email) metodoPagoData.email = data.email;
          if (data.contrasena) metodoPagoData.contrasena = data.contrasena;
          if (data.numeroTarjeta)
            metodoPagoData.numeroTarjeta = data.numeroTarjeta;
          if (data.fechaExpiracion)
            metodoPagoData.fechaExpiracion = data.fechaExpiracion;
        }
        await createMetodoPago(metodoPagoData);
        await fetchCounts(); // Actualizar mÃ©tricas
        toast.success("MÃ©todo de pago creado", {
          description:
            "El nuevo mÃ©todo de pago ha sido registrado correctamente.",
        });
      } else if (metodoPago) {
        const updates: Partial<MetodoPago> = {
          nombre: data.nombre,
          pais: data.pais,
          moneda: data.moneda,
          titular: data.titular,
          asociadoA: data.asociadoA,
        };
        if (data.alias) updates.alias = data.alias;
        if (data.notas) updates.notas = data.notas;
        if (data.asociadoA === "usuario") {
          updates.tipoCuenta = data.tipoCuenta;
          updates.identificador = data.identificador;
        } else if (data.asociadoA === "servicio") {
          updates.identificador = data.email || "";
          if (data.email) updates.email = data.email;
          if (data.contrasena) updates.contrasena = data.contrasena;
          if (data.numeroTarjeta) updates.numeroTarjeta = data.numeroTarjeta;
          if (data.fechaExpiracion)
            updates.fechaExpiracion = data.fechaExpiracion;
        }
        await updateMetodoPago(metodoPago.id, updates);
        await fetchCounts(); // Actualizar mÃ©tricas
        toast.success("MÃ©todo de pago actualizado", {
          description:
            "Los datos del mÃ©todo de pago han sido guardados correctamente.",
        });
      }
      router.push(returnTo);
    } catch (error) {
      const message =
        mode === "create"
          ? "Error al crear el mÃ©todo de pago"
          : "Error al actualizar el mÃ©todo de pago";
      toast.error(message, {
        description: error instanceof Error ? error.message : undefined,
      });
      console.error(error);
    }
  };

  const onCancel = () => {
    router.push(returnTo);
  };

  const getAsociadoALabel = (tipo: string) => {
    switch (tipo) {
      case "usuario":
        return "Usuario";
      case "servicio":
        return "Servicio";
      default:
        return "Seleccionar";
    }
  };

  const getTipoCuentaLabel = (tipo: string) => {
    switch (tipo) {
      case "ahorro":
        return "Ahorro";
      case "corriente":
        return "Corriente";
      case "wallet":
        return "Wallet";
      case "telefono":
        return "TelÃ©fono";
      case "email":
        return "Email";
      default:
        return "Seleccionar tipo";
    }
  };

  const onError = (errors: FieldErrors<FormData>) => {
    // Si hay errores en campos de informaciÃ³n adicional, cambiar a ese tab
    const additionalFields = [
      "titular",
      "tipoCuenta",
      "identificador",
      "email",
      "contrasena",
      "numeroTarjeta",
      "fechaExpiracion",
    ];
    const hasAdditionalErrors = Object.keys(errors).some((key) =>
      additionalFields.includes(key),
    );

    if (hasAdditionalErrors && activeTab === "basica") {
      setActiveTab("adicional");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-6">
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="mb-8 bg-transparent rounded-none p-0 h-auto inline-flex border-b border-border">
          <TabsTrigger
            value="basica"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
          >
            InformaciÃ³n BÃ¡sica
          </TabsTrigger>
          <TabsTrigger
            value="adicional"
            className={`rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm ${
              !isBasicaTabComplete ? "cursor-not-allowed opacity-50" : ""
            }`}
          >
            InformaciÃ³n Adicional
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basica" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nombre del MÃ©todo */}
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre del MÃ©todo</Label>
              <Input
                id="nombre"
                {...register("nombre")}
                placeholder="Ingrese el nombre del mÃ©todo"
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

            {/* Asociado a */}
            <div className="space-y-2">
              <Label htmlFor="asociadoA">Asociado a</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    type="button"
                  >
                    {getAsociadoALabel(asociadoAValue)}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  <DropdownMenuItem
                    onClick={() => setValue("asociadoA", "usuario")}
                  >
                    Usuario
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setValue("asociadoA", "servicio")}
                  >
                    Servicio
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {errors.asociadoA && (
                <p className="text-sm text-red-500">
                  {errors.asociadoA.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PaÃ­s */}
            <div className="space-y-2">
              <Label htmlFor="pais">PaÃ­s</Label>
              <DropdownMenu
                onOpenChange={(open) => {
                  if (!open) {
                    setTimeout(() => setPaisSearch(""), 200);
                  }
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    type="button"
                  >
                    {paisValue || "Seleccionar paÃ­s"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  <div
                    className="p-2 border-b"
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar paÃ­s..."
                        value={paisSearch}
                        onChange={(e) => setPaisSearch(e.target.value)}
                        className="h-8 pl-8"
                        autoFocus
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    {PAISES_MONEDAS.filter((pm) =>
                      pm.pais.toLowerCase().includes(paisSearch.toLowerCase()),
                    ).map((pm) => (
                      <DropdownMenuItem
                        key={pm.pais}
                        onClick={() => {
                          setValue("pais", pm.pais);
                        }}
                      >
                        {pm.pais}
                      </DropdownMenuItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              {errors.pais && (
                <p className="text-sm text-red-500">{errors.pais.message}</p>
              )}
            </div>

            {/* Moneda */}
            <div className="space-y-2">
              <Label htmlFor="moneda">Moneda</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    type="button"
                  >
                    {monedaValue || "Seleccionar moneda"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  {MONEDAS.map((moneda) => (
                    <DropdownMenuItem
                      key={moneda}
                      onClick={() => setValue("moneda", moneda)}
                    >
                      {moneda}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {errors.moneda && (
                <p className="text-sm text-red-500">{errors.moneda.message}</p>
              )}
            </div>
          </div>

          {/* Alias */}
          <div className="space-y-2">
            <Label htmlFor="alias">Alias</Label>
            <Input
              id="alias"
              {...register("alias")}
              placeholder="Ingrese un alias para identificar este mÃ©todo de pago"
            />
          </div>

          {/* Botones Tab 1 */}
          <div className="flex gap-3 justify-end pt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleNext}>
              Siguiente
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="adicional" className="space-y-4">
          {/* Nombre del Titular */}
          <div className="space-y-2">
            <Label htmlFor="titular">Nombre del Titular</Label>
            <Input
              id="titular"
              {...register("titular")}
              placeholder="Ingrese el nombre del Titular"
              onChange={(e) => {
                const value = e.target.value;
                const capitalized =
                  value.charAt(0).toUpperCase() + value.slice(1);
                setValue("titular", capitalized);
              }}
            />
            {errors.titular && (
              <p className="text-sm text-red-500">{errors.titular.message}</p>
            )}
          </div>

          {/* Campos condicionales segÃºn asociadoA */}
          {asociadoAValue === "usuario" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tipo de Cuenta */}
                <div className="space-y-2">
                  <Label htmlFor="tipoCuenta">Tipo de Cuenta</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                        type="button"
                      >
                        {getTipoCuentaLabel(tipoCuentaValue || "")}
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-[var(--radix-dropdown-menu-trigger-width)]"
                    >
                      <DropdownMenuItem
                        onClick={() => setValue("tipoCuenta", "ahorro")}
                      >
                        Ahorro
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setValue("tipoCuenta", "corriente")}
                      >
                        Corriente
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setValue("tipoCuenta", "email")}
                      >
                        Email
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setValue("tipoCuenta", "telefono")}
                      >
                        TelÃ©fono
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setValue("tipoCuenta", "wallet")}
                      >
                        Wallet
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {errors.tipoCuenta && (
                    <p className="text-sm text-red-500">
                      {errors.tipoCuenta.message}
                    </p>
                  )}
                </div>

                {/* Identificador de cuenta */}
                <div className="space-y-2">
                  <Label htmlFor="identificador">Identificador de cuenta</Label>
                  <Input
                    id="identificador"
                    {...register("identificador")}
                    placeholder="Ingrese el identificador"
                  />
                  {errors.identificador && (
                    <p className="text-sm text-red-500">
                      {errors.identificador.message}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {asociadoAValue === "servicio" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register("email")}
                    placeholder="Ingrese el email"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* ContraseÃ±a */}
                <div className="space-y-2">
                  <Label htmlFor="contrasena">ContraseÃ±a</Label>
                  <Input
                    id="contrasena"
                    type="text"
                    {...register("contrasena")}
                    placeholder="Ingrese la contraseÃ±a"
                  />
                  {errors.contrasena && (
                    <p className="text-sm text-red-500">
                      {errors.contrasena.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* NÃºmero de Tarjeta */}
                <div className="space-y-2">
                  <Label htmlFor="numeroTarjeta">NÃºmero de Tarjeta</Label>
                  <Input
                    id="numeroTarjeta"
                    {...register("numeroTarjeta")}
                    placeholder="1234 5678 9012 3456"
                    maxLength={24}
                    onChange={(e) => {
                      // Eliminar todos los espacios y caracteres no numÃ©ricos
                      let value = e.target.value.replace(/\D/g, "");

                      // Limitar a 19 dÃ­gitos
                      if (value.length > 19) {
                        value = value.slice(0, 19);
                      }

                      // Agregar espacios cada 4 dÃ­gitos
                      const formatted =
                        value.match(/.{1,4}/g)?.join(" ") || value;

                      setValue("numeroTarjeta", formatted);
                    }}
                    onKeyDown={(e) => {
                      const allowedKeys = [
                        "Backspace",
                        "Delete",
                        "Tab",
                        "Escape",
                        "Enter",
                        "ArrowLeft",
                        "ArrowRight",
                      ];
                      const allowedChars = /[0-9]/;

                      if (
                        allowedKeys.includes(e.key) ||
                        allowedChars.test(e.key)
                      ) {
                        return;
                      }

                      e.preventDefault();
                    }}
                  />
                  {errors.numeroTarjeta && (
                    <p className="text-sm text-red-500">
                      {errors.numeroTarjeta.message}
                    </p>
                  )}
                </div>

                {/* Fecha de ExpiraciÃ³n */}
                <div className="space-y-2">
                  <Label htmlFor="fechaExpiracion">Fecha de ExpiraciÃ³n</Label>
                  <Input
                    id="fechaExpiracion"
                    placeholder="MM/YY"
                    maxLength={5}
                    value={fechaExpiracionValue || ""}
                    onChange={(e) => {
                      const input = e.target.value;
                      const previousValue = fechaExpiracionValue || "";
                      const digits = input.replace(/\D/g, "");
                      const isDeleting = input.length < previousValue.length;

                      if (digits.length === 0) {
                        setValue("fechaExpiracion", "");
                        return;
                      }

                      const limitedDigits = digits.slice(0, 4);

                      // Si estÃ¡ borrando y solo quedan 2 dÃ­gitos, NO agregar la /
                      if (isDeleting && limitedDigits.length <= 2) {
                        setValue("fechaExpiracion", limitedDigits);
                        return;
                      }

                      // Solo agregar / cuando hay mÃ¡s de 2 dÃ­gitos (escribiendo)
                      let formatted = limitedDigits;
                      if (limitedDigits.length > 2) {
                        formatted =
                          limitedDigits.slice(0, 2) +
                          "/" +
                          limitedDigits.slice(2);
                      } else if (limitedDigits.length === 2 && !isDeleting) {
                        formatted = limitedDigits + "/";
                      }

                      setValue("fechaExpiracion", formatted);
                    }}
                  />
                  {errors.fechaExpiracion && (
                    <p className="text-sm text-red-500">
                      {errors.fechaExpiracion.message}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              {...register("notas")}
              placeholder="InformaciÃ³n adicional relevante..."
              rows={6}
            />
          </div>

          {/* Botones Tab 2 */}
          <div className="flex gap-3 justify-end pt-4">
            <Button type="button" variant="outline" onClick={handlePrevious}>
              Anterior
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || (mode === "edit" && !hasChanges)}
            >
              {isSubmitting
                ? mode === "create"
                  ? "Creando..."
                  : "Guardando..."
                : mode === "create"
                  ? "Crear MÃ©todo de Pago"
                  : "Guardar Cambios"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </form>
  );
}
