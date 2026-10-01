"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { usuarioSchema, getTerceroFormValues, type TerceroFormData, type TerceroValoresIniciales } from './tercero-form-values';
import { submitTerceroForm } from './tercero-form-submit';

import {
  createPendingTerceroPaymentMethod,
  isPendingTerceroPaymentMethodId,
  PENDING_TERCERO_PAYMENT_ID,
} from "@/platform/utils/terceroMetodoPago";
import type { MetodoPago, Tercero } from "@/types";


interface UseTerceroFormControllerParams {
  usuario?: Tercero | null;
  tipoInicial: "cliente" | "revendedor";
  metodosPago: MetodoPago[];
  onSuccess?: () => void;
  valoresIniciales?: TerceroValoresIniciales;
}

// Datos sugeridos al crear un tercero desde otro flujo (p. ej. un chat de WhatsApp).
export type { TerceroValoresIniciales } from './tercero-form-values';

export function useTerceroFormController({
  usuario,
  tipoInicial,
  metodosPago,
  onSuccess,
  valoresIniciales,
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
    reset(getTerceroFormValues(usuario, tipoInicial, valoresIniciales));
  }, [usuario, tipoInicial, reset, valoresIniciales]);

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

  const onSubmit = (data: TerceroFormData) => submitTerceroForm(data, usuario, metodosPago, queryClient, onSuccess);

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
