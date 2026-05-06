"use client";

import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCategoriasStore } from "@/store/categoriasStore";
import type { Categoria, Plan, TipoPlanConfig } from "@/types";

import { CategoriaBasicInfoSection } from "./form/CategoriaBasicInfoSection";
import { CategoriaPlansSection } from "./form/CategoriaPlansSection";
import {
  categoriaSchema,
  getCreatePlanesValidationError,
  hasCategoriaChanges,
  type CategoriaFormData,
} from "./form/categoria-form-helpers";

interface CategoriaFormProps {
  mode: "create" | "edit";
  categoria?: Categoria;
  returnTo?: string;
}

function createUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = char === "x" ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
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

  const [tiposPlanes, setTiposPlanes] = useState<TipoPlanConfig[]>(() => {
    if (mode !== "edit" || !categoria) return [];
    return categoria.tiposPlanes || [];
  });
  const [tipoSeleccionadoId, setTipoSeleccionadoId] = useState<string | null>(
    () => {
      if (mode !== "edit" || !categoria) return null;
      return categoria.tiposPlanes?.[0]?.id || null;
    },
  );
  const [nuevoTipoNombre, setNuevoTipoNombre] = useState("");
  const [showNuevoTipoInput, setShowNuevoTipoInput] = useState(false);
  const [tipoNombreError, setTipoNombreError] = useState("");
  const [editandoTipoId, setEditandoTipoId] = useState<string | null>(null);
  const [editTipoNombre, setEditTipoNombre] = useState("");
  const [editTipoError, setEditTipoError] = useState("");
  const [planes, setPlanes] = useState<Plan[]>(
    mode === "edit" && categoria ? categoria.planes || [] : [],
  );
  const [planesError, setPlanesError] = useState<string>("");

  useEffect(() => {
    if (tiposPlanes.length > 0 && !tipoSeleccionadoId) {
      setTipoSeleccionadoId(tiposPlanes[0].id);
    }
    if (tiposPlanes.length === 0) {
      setTipoSeleccionadoId(null);
    }
  }, [tiposPlanes, tipoSeleccionadoId]);

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

  const handleAgregarTipo = () => {
    const trimmed = nuevoTipoNombre.trim();
    if (!trimmed) {
      setTipoNombreError("El nombre no puede estar vacío");
      return;
    }
    if (
      tiposPlanes.some((t) => t.nombre.toLowerCase() === trimmed.toLowerCase())
    ) {
      setTipoNombreError("Ya existe un tipo con ese nombre");
      return;
    }

    const nuevoTipo: TipoPlanConfig = {
      id: createUuid(),
      nombre: trimmed,
    };
    setTiposPlanes((prev) => [...prev, nuevoTipo]);
    setTipoSeleccionadoId(nuevoTipo.id);
    setNuevoTipoNombre("");
    setTipoNombreError("");
    setShowNuevoTipoInput(false);
    setPlanesError("");
  };

  const handleCancelarNuevoTipo = () => {
    setShowNuevoTipoInput(false);
    setNuevoTipoNombre("");
    setTipoNombreError("");
  };

  const handleEliminarTipo = (tipoId: string) => {
    const remaining = tiposPlanes.filter((t) => t.id !== tipoId);
    setTiposPlanes(remaining);
    setPlanes((prev) => prev.filter((p) => p.tipoPlan !== tipoId));
    if (tipoSeleccionadoId === tipoId) {
      setTipoSeleccionadoId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleIniciarEdicion = (
    tipo: TipoPlanConfig,
    e: MouseEvent<HTMLButtonElement>,
  ) => {
    e.stopPropagation();
    setEditandoTipoId(tipo.id);
    setEditTipoNombre(tipo.nombre);
    setEditTipoError("");
  };

  const handleGuardarEdicion = (
    e?: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e) e.stopPropagation();
    const trimmed = editTipoNombre.trim();
    if (!trimmed) {
      setEditTipoError("El nombre no puede estar vacío");
      return;
    }
    if (
      tiposPlanes.some(
        (t) =>
          t.id !== editandoTipoId &&
          t.nombre.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      setEditTipoError("Ya existe un tipo con ese nombre");
      return;
    }

    setTiposPlanes((prev) =>
      prev.map((t) =>
        t.id === editandoTipoId ? { ...t, nombre: trimmed } : t,
      ),
    );
    setEditandoTipoId(null);
  };

  const handleCancelarEdicion = (
    e?: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e) e.stopPropagation();
    setEditandoTipoId(null);
  };

  const agregarPlan = (tipoPlanId: string) => {
    const nuevoPlan: Plan = {
      id: createUuid(),
      nombre: "",
      precio: 0,
      cicloPago: "mensual",
      tipoPlan: tipoPlanId,
    };
    setPlanes((prev) => [...prev, nuevoPlan]);
    setPlanesError("");
  };

  const eliminarPlan = (id: string) => {
    setPlanes((prev) => prev.filter((plan) => plan.id !== id));
  };

  const actualizarPlan = (
    id: string,
    campo: keyof Plan,
    valor: string | number,
  ) => {
    setPlanes((prev) =>
      prev.map((plan) => (plan.id === id ? { ...plan, [campo]: valor } : plan)),
    );
  };

  const planesDeTipoActual = useMemo(
    () =>
      tipoSeleccionadoId
        ? planes.filter((p) => p.tipoPlan === tipoSeleccionadoId)
        : [],
    [planes, tipoSeleccionadoId],
  );

  const tipoActual = tiposPlanes.find((t) => t.id === tipoSeleccionadoId);

  const onSubmit = async (data: CategoriaFormData) => {
    if (mode === "create") {
      const planesValidationError = getCreatePlanesValidationError(
        tiposPlanes,
        planes,
      );
      if (planesValidationError) {
        setPlanesError(planesValidationError);
        setActiveTab("planes");
        return;
      }
    }

    try {
      setPlanesError("");
      if (mode === "create") {
        await createCategoria({
          nombre: data.nombre,
          tipo: data.tipo,
          tipoCategoria: data.tipoCategoria,
          notas: data.notas || "",
          tiposPlanes: tiposPlanes,
          planes: planes,
          activo: true,
          totalServicios: 0,
          serviciosActivos: 0,
          perfilesDisponiblesTotal: 0,
          ventasTotales: 0,
          ingresosTotales: 0,
          gastosTotal: 0,
        });
        toast.success("Categoría creada", {
          description: "La nueva categoría ha sido registrada correctamente.",
        });
      } else if (categoria) {
        await updateCategoria(categoria.id, {
          nombre: data.nombre,
          tipo: data.tipo,
          tipoCategoria: data.tipoCategoria,
          tiposPlanes: tiposPlanes,
          planes: planes,
          notas: data.notas,
          activo: categoria.activo,
        });
        toast.success("Categoría actualizada", {
          description:
            "Los cambios en la categoría han sido guardados correctamente.",
        });
      }
      router.push(returnTo);
    } catch (error) {
      const message =
        mode === "create"
          ? "Error al crear la categoría"
          : "Error al actualizar la categoría";
      toast.error(message, {
        description: error instanceof Error ? error.message : undefined,
      });
      console.error(error);
    }
  };

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
