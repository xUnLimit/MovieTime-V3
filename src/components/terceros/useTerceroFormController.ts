"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "@/platform/validation/zod";

import {
  createTerceroMutation,
  updateTerceroMutation,
} from "@/application/client-domain-mutations";
import { queryKeys } from "@/platform/query-keys";
import { getPublicErrorMessage } from "@/platform/errors/public-errors";
import {
  createPendingTerceroPaymentMethod,
  getTerceroMetodoPagoMoneda,
  isPendingTerceroPaymentMethodId,
  PENDING_TERCERO_PAYMENT_ID,
  PENDING_TERCERO_PAYMENT_NAME,
} from "@/platform/utils/terceroMetodoPago";
import type { MetodoPago, Tercero } from "@/types";

const usuarioSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  apellido: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
  tipoTercero: z.enum(["cliente", "revendedor"], {
    message: "Debe seleccionar un tipo de tercero",
  }),
  telefono: z.string().min(8, "El telefono debe tener al menos 8 digitos"),
  metodoPagoId: z.string().min(1, "El metodo de pago es requerido"),
  notas: z.string().optional(),
});

type TerceroFormData = z.infer<typeof usuarioSchema>;

function formatearTelefono(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    const sinPlus = trimmed.slice(1);
    const digits = sinPlus.replace(/\D/g, "");
    if (digits.length > 8) {
      const countryCode = digits.slice(0, digits.length - 8);
      const local = digits.slice(digits.length - 8);
      return "+" + countryCode + " " + local.slice(0, 4) + "-" + local.slice(4);
    }
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 8) {
    return "+507 " + digits.slice(0, 4) + "-" + digits.slice(4);
  }
  return trimmed;
}

interface UseTerceroFormControllerParams {
  usuario?: Tercero | null;
  tipoInicial: "cliente" | "revendedor";
  metodosPago: MetodoPago[];
  onSuccess?: () => void;
}

export function useTerceroFormController({
  usuario,
  tipoInicial,
  metodosPago,
  onSuccess,
}: UseTerceroFormControllerParams) {
  const queryClient = useQueryClient();
  const pendienteOption = useMemo<MetodoPago>(
    () => createPendingTerceroPaymentMethod(),
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
  } = useForm<TerceroFormData>({
    resolver: zodResolver(usuarioSchema),
    defaultValues: {
      nombre: "",
      apellido: "",
      tipoTercero: "" as "cliente" | "revendedor",
      telefono: "",
      metodoPagoId: PENDING_TERCERO_PAYMENT_ID,
      notas: "",
    },
  });

  const tipoTerceroValue = watch("tipoTercero");
  const metodoPagoIdValue = watch("metodoPagoId");
  const nombreValue = watch("nombre");
  const apellidoValue = watch("apellido");
  const telefonoValue = watch("telefono");
  const notasValue = watch("notas");
  const metodosPagoOrdenados = useMemo(
    () => [
      pendienteOption,
      ...metodosPago
        .filter((metodo) => metodo.asociadoA === "tercero")
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    ],
    [metodosPago, pendienteOption],
  );

  // Detectar si hay cambios en el formulario (solo en modo edición)
  const hasChanges = useMemo(() => {
    if (!usuario) return true; // En modo creación, siempre permitir guardar

    const terceroMetodoPagoId = isPendingTerceroPaymentMethodId(
      usuario.metodoPagoId,
    )
      ? PENDING_TERCERO_PAYMENT_ID
      : usuario.metodoPagoId;

    return (
      nombreValue !== (usuario.nombre || "") ||
      apellidoValue !== (usuario.apellido || "") ||
      tipoTerceroValue !== usuario.tipo ||
      telefonoValue !== usuario.telefono ||
      metodoPagoIdValue !== terceroMetodoPagoId ||
      (notasValue ?? "") !== (usuario.notas ?? "")
    );
  }, [
    usuario,
    nombreValue,
    apellidoValue,
    tipoTerceroValue,
    telefonoValue,
    metodoPagoIdValue,
    notasValue,
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
    if (tipoTerceroValue && errors.tipoTercero) {
      clearErrors("tipoTercero");
    }
  }, [tipoTerceroValue, errors.tipoTercero, clearErrors]);

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
        tipoTercero: usuario.tipo,
        telefono: usuario.telefono,
        metodoPagoId: isPendingTerceroPaymentMethodId(usuario.metodoPagoId)
          ? PENDING_TERCERO_PAYMENT_ID
          : usuario.metodoPagoId,
        notas: usuario.notas || "",
      });
    } else {
      reset({
        nombre: "",
        apellido: "",
        tipoTercero: tipoInicial as "cliente" | "revendedor",
        telefono: "",
        metodoPagoId: PENDING_TERCERO_PAYMENT_ID,
        notas: "",
      });
    }
  }, [usuario, tipoInicial, reset]);

  const handleNext = async () => {
    // Validar campos de la pestaña personal
    const isValid = await trigger([
      "nombre",
      "apellido",
      "tipoTercero",
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

  const onSubmit = async (data: TerceroFormData) => {
    try {
      const metodoPago = isPendingTerceroPaymentMethodId(data.metodoPagoId)
        ? null
        : metodosPago.find((m) => m.id === data.metodoPagoId);

      const telefonoFormateado = formatearTelefono(data.telefono);

      const usuarioData = {
        nombre: data.nombre,
        apellido: data.apellido,
        tipo: data.tipoTercero,
        telefono: telefonoFormateado,
        metodoPagoId: data.metodoPagoId,
        metodoPagoNombre: metodoPago?.nombre || PENDING_TERCERO_PAYMENT_NAME,
        moneda: getTerceroMetodoPagoMoneda(
          data.metodoPagoId,
          metodoPago?.moneda,
        ),
        notas: data.notas?.trim() || "",
        active: true,
        createdBy: "current-user",
      };

      if (usuario) {
        // Actualizar tercero existente (incluyendo cambio de tipo si es necesario)
        await updateTerceroMutation(usuario.id, usuarioData, usuario);
        const cambioTipo = usuario.tipo !== data.tipoTercero;
        toast.success(
          cambioTipo
            ? "Tipo de tercero actualizado"
            : `${data.tipoTercero === "cliente" ? "Cliente" : "Revendedor"} actualizado`,
          {
            description: cambioTipo
              ? `El tercero ha sido convertido a ${data.tipoTercero} correctamente.`
              : "Los datos del tercero han sido actualizados correctamente.",
          },
        );
      } else {
        // Crear nuevo tercero
        await createTerceroMutation(usuarioData);
        toast.success(
          `${data.tipoTercero === "cliente" ? "Cliente" : "Revendedor"} creado`,
          {
            description: `El nuevo ${data.tipoTercero} ha sido registrado correctamente en el sistema.`,
          },
        );
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.terceros.all });
      onSuccess?.();
    } catch (error) {
      toast.error("Error al guardar tercero", {
        description: getPublicErrorMessage(error, "No se pudo guardar el tercero."),
      });
    }
  };

  const handleTabChange = async (value: string) => {
    if (value === "pago" && !isPersonalTabComplete) {
      const isValid = await trigger([
        "nombre",
        "apellido",
        "tipoTercero",
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

  return {
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
  };
}
