"use client";

import { useMemo, useState } from "react";
import type { FieldErrors } from "react-hook-form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createMetodoPagoMutation,
  updateMetodoPagoMutation,
} from "@/lib/client-domain-mutations";
import { useRouter } from "next/navigation";
import { MetodoPago } from "@/types";
import { AdditionalInfoSection } from "./form/AdditionalInfoSection";
import { BasicInfoSection } from "./form/BasicInfoSection";
import {
  getMetodoPagoDefaultValues,
  hasMetodoPagoFormChanges,
  type MetodoPagoFormMode,
} from "./form/helpers";
import {
  metodoPagoSchemaComplete,
  type MetodoPagoFormData,
} from "./form/schema";
import { useMetodoPagoFormEffects } from "./form/useMetodoPagoFormEffects";
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

  useMetodoPagoFormEffects({
    asociadoAValue,
    clearErrors,
    contrasenaValue,
    emailValue,
    errors,
    fechaExpiracionValue,
    identificadorValue,
    metodoPago,
    mode,
    monedaValue,
    nombreValue,
    numeroTarjetaValue,
    paisValue,
    setValue,
    tipoCuentaValue,
    titularValue,
  });

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
    createMetodoPago: createMetodoPagoMutation,
    hasChanges,
    metodoPago,
    mode,
    queryClient,
    returnTo,
    routerPush: router.push,
    updateMetodoPago: (id, updates) => updateMetodoPagoMutation(id, updates, metodoPago),
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
