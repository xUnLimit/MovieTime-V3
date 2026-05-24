"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FieldErrors } from "react-hook-form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMetodosPagoStore } from "@/store/metodosPagoStore";
import { useRouter } from "next/navigation";
import { MetodoPago } from "@/types";
import { AdditionalInfoSection } from "./form/AdditionalInfoSection";
import { BasicInfoSection } from "./form/BasicInfoSection";
import {
  getMetodoPagoDefaultValues,
  hasMetodoPagoFormChanges,
  type MetodoPagoFormMode,
} from "./form/helpers";
import { PAISES_MONEDAS } from "./form/options";
import {
  metodoPagoSchemaComplete,
  type MetodoPagoFormData,
} from "./form/schema";
import { useMetodoPagoFormSubmit } from "./form/useMetodoPagoFormSubmit";

interface MetodoPagoFormProps {
  mode: MetodoPagoFormMode;
  metodoPago?: MetodoPago;
  returnTo?: string;
}

const ADDITIONAL_FIELDS = [
  "titular",
  "tipoCuenta",
  "identificador",
  "email",
  "contrasena",
  "numeroTarjeta",
  "fechaExpiracion",
];

export function MetodoPagoForm({
  mode,
  metodoPago,
  returnTo = "/metodos-pago",
}: MetodoPagoFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { createMetodoPago, updateMetodoPago } = useMetodosPagoStore();
  const [activeTab, setActiveTab] = useState("basica");
  const [paisSearch, setPaisSearch] = useState("");
  const [isBasicaTabComplete, setIsBasicaTabComplete] = useState(
    mode === "edit",
  );
  const didSkipInitialPaisSyncRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    clearErrors,
    trigger,
  } = useForm<MetodoPagoFormData>({
    resolver: zodResolver(metodoPagoSchemaComplete),
    defaultValues: getMetodoPagoDefaultValues(mode, metodoPago),
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

  const hasChanges = useMemo(
    () =>
      hasMetodoPagoFormChanges(mode, metodoPago, {
        nombre: nombreValue,
        asociadoA: asociadoAValue,
        pais: paisValue,
        moneda: monedaValue,
        alias: aliasValue,
        titular: titularValue,
        tipoCuenta: tipoCuentaValue,
        identificador: identificadorValue,
        email: emailValue,
        contrasena: contrasenaValue,
        numeroTarjeta: numeroTarjetaValue,
        fechaExpiracion: fechaExpiracionValue,
        notas: notasValue,
      }),
    [
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
    ],
  );

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

  useEffect(() => {
    if (paisValue) {
      if (
        mode === "edit" &&
        metodoPago &&
        !didSkipInitialPaisSyncRef.current
      ) {
        didSkipInitialPaisSyncRef.current = true;
        return;
      }

      const paisMoneda = PAISES_MONEDAS.find((pm) => pm.pais === paisValue);
      if (paisMoneda) {
        setValue("moneda", paisMoneda.moneda);
      }
    }
  }, [mode, metodoPago, paisValue, setValue]);

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

  const onSubmit = useMetodoPagoFormSubmit({
    createMetodoPago,
    hasChanges,
    metodoPago,
    mode,
    queryClient,
    returnTo,
    routerPush: router.push,
    updateMetodoPago,
  });
  const onCancel = () => {
    router.push(returnTo);
  };

  const onError = (errors: FieldErrors<MetodoPagoFormData>) => {
    const hasAdditionalErrors = Object.keys(errors).some((key) =>
      ADDITIONAL_FIELDS.includes(key),
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
            Información Básica
          </TabsTrigger>
          <TabsTrigger
            value="adicional"
            className={`rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm ${
              !isBasicaTabComplete ? "cursor-not-allowed opacity-50" : ""
            }`}
          >
            Información Adicional
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basica" className="space-y-4">
          <BasicInfoSection
            register={register}
            errors={errors}
            setValue={setValue}
            asociadoAValue={asociadoAValue}
            paisValue={paisValue}
            monedaValue={monedaValue}
            paisSearch={paisSearch}
            setPaisSearch={setPaisSearch}
            onCancel={onCancel}
            onNext={handleNext}
          />
        </TabsContent>

        <TabsContent value="adicional" className="space-y-4">
          <AdditionalInfoSection
            mode={mode}
            register={register}
            errors={errors}
            setValue={setValue}
            asociadoAValue={asociadoAValue}
            tipoCuentaValue={tipoCuentaValue}
            fechaExpiracionValue={fechaExpiracionValue}
            isSubmitting={isSubmitting}
            hasChanges={hasChanges}
            onPrevious={handlePrevious}
          />
        </TabsContent>
      </Tabs>
    </form>
  );
}
