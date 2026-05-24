"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCategoriasStore } from "@/store/categoriasStore";
import type { Categoria } from "@/types";

import { CategoriaBasicInfoSection } from "./form/CategoriaBasicInfoSection";
import { CategoriaPlansSection } from "./form/CategoriaPlansSection";
import {
  categoriaSchema,
  hasCategoriaChanges,
  type CategoriaFormData,
} from "./form/categoria-form-helpers";
import { useCategoriaFormSubmit } from "./form/useCategoriaFormSubmit";
import { useCategoriaPlansState } from "./form/useCategoriaPlansState";

interface CategoriaFormProps {
  mode: "create" | "edit";
  categoria?: Categoria;
  returnTo?: string;
}

export function CategoriaForm({
  mode,
  categoria,
  returnTo = "/categorias",
}: CategoriaFormProps) {
  const router = useRouter();
  const { createCategoria, updateCategoria } = useCategoriasStore();
  const [activeTab, setActiveTab] = useState("general");
  const [isGeneralTabComplete, setIsGeneralTabComplete] = useState(
    mode === "edit",
  );
  const categoriaPlans = useCategoriaPlansState({ categoria, mode });
  const {
    editTipoError,
    editTipoNombre,
    editandoTipoId,
    nuevoTipoNombre,
    planes,
    planesDeTipoActual,
    planesError,
    showNuevoTipoInput,
    tipoActual,
    tipoNombreError,
    tipoSeleccionadoId,
    tiposPlanes,
    agregarPlan,
    actualizarPlan,
    eliminarPlan,
    handleAgregarTipo,
    handleCancelarEdicion,
    handleCancelarNuevoTipo,
    handleEliminarTipo,
    handleGuardarEdicion,
    handleIniciarEdicion,
    setEditTipoError,
    setEditTipoNombre,
    setNuevoTipoNombre,
    setPlanesError,
    setShowNuevoTipoInput,
    setTipoNombreError,
    setTipoSeleccionadoId,
  } = categoriaPlans;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    clearErrors,
    trigger,
  } = useForm<CategoriaFormData>({
    resolver: zodResolver(categoriaSchema),
    defaultValues:
      mode === "edit" && categoria
        ? {
            nombre: categoria.nombre,
            tipo: categoria.tipo,
            tipoCategoria: categoria.tipoCategoria,
            notas: categoria.notas || "",
          }
        : {
            nombre: "",
            tipo: "" as "cliente" | "revendedor",
            tipoCategoria: "" as "plataforma_streaming" | "otros",
            notas: "",
          },
  });

  const nombreValue = watch("nombre");
  const tipoValue = watch("tipo");
  const tipoCategoriaValue = watch("tipoCategoria");
  const notasValue = watch("notas");

  const hasChanges = useMemo(
    () =>
      hasCategoriaChanges({
        categoria,
        mode,
        nombreValue,
        notasValue,
        planes,
        tipoCategoriaValue,
        tipoValue,
        tiposPlanes,
      }),
    [
      categoria,
      mode,
      nombreValue,
      notasValue,
      planes,
      tipoCategoriaValue,
      tipoValue,
      tiposPlanes,
    ],
  );

  useEffect(() => {
    if (nombreValue && nombreValue.length >= 2 && errors.nombre) {
      clearErrors("nombre");
    }
  }, [nombreValue, errors.nombre, clearErrors]);

  useEffect(() => {
    if (tipoValue && errors.tipo) clearErrors("tipo");
  }, [tipoValue, errors.tipo, clearErrors]);

  useEffect(() => {
    if (tipoCategoriaValue && errors.tipoCategoria) {
      clearErrors("tipoCategoria");
    }
  }, [tipoCategoriaValue, errors.tipoCategoria, clearErrors]);

  const onSubmit = useCategoriaFormSubmit({
    categoria,
    createCategoria,
    mode,
    planes,
    returnTo,
    router,
    setActiveTab,
    setPlanesError,
    tiposPlanes,
    updateCategoria,
  });
  const onCancel = () => router.push(returnTo);

  const handleTabChange = async (value: string) => {
    if (value === "planes" && !isGeneralTabComplete) {
      const isValid = await trigger(["nombre", "tipo", "tipoCategoria"]);
      if (isValid) {
        setIsGeneralTabComplete(true);
        setActiveTab(value);
      }
    } else {
      setActiveTab(value);
    }
  };

  const handleNext = async () => {
    const isValid = await trigger(["nombre", "tipo", "tipoCategoria"]);
    if (isValid) {
      setIsGeneralTabComplete(true);
      setActiveTab("planes");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="mb-8 bg-transparent rounded-none p-0 h-auto inline-flex border-b border-border">
          <TabsTrigger
            value="general"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
          >
            Información General
          </TabsTrigger>
          <TabsTrigger
            value="planes"
            className={`rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm ${!isGeneralTabComplete ? "cursor-not-allowed opacity-50" : ""}`}
          >
            Tipos y Planes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <CategoriaBasicInfoSection
            errors={errors}
            register={register}
            setValue={setValue}
            tipoCategoriaValue={tipoCategoriaValue}
            tipoValue={tipoValue}
            onCancel={onCancel}
            onNext={handleNext}
          />
        </TabsContent>

        <TabsContent value="planes">
          <CategoriaPlansSection
            editTipoError={editTipoError}
            editTipoNombre={editTipoNombre}
            editandoTipoId={editandoTipoId}
            hasChanges={hasChanges}
            isEditMode={mode === "edit"}
            isSubmitting={isSubmitting}
            nuevoTipoNombre={nuevoTipoNombre}
            planes={planes}
            planesDeTipoActual={planesDeTipoActual}
            planesError={planesError}
            showNuevoTipoInput={showNuevoTipoInput}
            tipoActual={tipoActual}
            tipoNombreError={tipoNombreError}
            tipoSeleccionadoId={tipoSeleccionadoId}
            tiposPlanes={tiposPlanes}
            onAddPlan={agregarPlan}
            onAddTipo={handleAgregarTipo}
            onCancelEdit={handleCancelarEdicion}
            onCancelNewTipo={handleCancelarNuevoTipo}
            onDeletePlan={eliminarPlan}
            onDeleteTipo={handleEliminarTipo}
            onPrevious={() => setActiveTab("general")}
            onSaveEdit={handleGuardarEdicion}
            onSelectTipo={setTipoSeleccionadoId}
            onStartEdit={handleIniciarEdicion}
            onUpdatePlan={actualizarPlan}
            setEditTipoError={setEditTipoError}
            setEditTipoNombre={setEditTipoNombre}
            setNuevoTipoNombre={setNuevoTipoNombre}
            setShowNuevoTipoInput={setShowNuevoTipoInput}
            setTipoNombreError={setTipoNombreError}
          />
        </TabsContent>
      </Tabs>
    </form>
  );
}
