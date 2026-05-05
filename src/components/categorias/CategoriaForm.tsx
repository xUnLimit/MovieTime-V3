"use client";

import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
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
import { ChevronDown, Plus, Trash2, Tag, Edit, X, Check } from "lucide-react";
import { useCategoriasStore } from "@/store/categoriasStore";
import { useRouter } from "next/navigation";
import { Plan, TipoPlanConfig, Categoria } from "@/types";

const categoriaSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  tipo: z.enum(["cliente", "revendedor", "ambos"], {
    message: "Debe seleccionar asociado a",
  }),
  tipoCategoria: z.enum(["plataforma_streaming", "otros"], {
    message: "Debe seleccionar un tipo de categoría",
  }),
  notas: z.string().optional(),
});

type FormData = z.infer<typeof categoriaSchema>;

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

  // Tipos de plan state
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

  // Estados para editar tipo de plan existente
  const [editandoTipoId, setEditandoTipoId] = useState<string | null>(null);
  const [editTipoNombre, setEditTipoNombre] = useState("");
  const [editTipoError, setEditTipoError] = useState("");

  // Planes state
  const [planes, setPlanes] = useState<Plan[]>(
    mode === "edit" && categoria ? categoria.planes || [] : [],
  );
  const [planesError, setPlanesError] = useState<string>("");

  // Auto-select first tipo when list changes
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
  } = useForm<FormData>({
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
            tipo: "" as "cliente" | "revendedor" | "ambos",
            tipoCategoria: "" as "plataforma_streaming" | "otros",
            notas: "",
          },
  });

  const nombreValue = watch("nombre");
  const tipoValue = watch("tipo");
  const tipoCategoriaValue = watch("tipoCategoria");
  const notasValue = watch("notas");

  const hasChanges = useMemo(() => {
    if (mode !== "edit" || !categoria) return true;
    const originalPlanes = categoria.planes || [];
    const originalTipos = categoria.tiposPlanes || [];
    if (nombreValue !== categoria.nombre) return true;
    if (tipoValue !== categoria.tipo) return true;
    if (tipoCategoriaValue !== categoria.tipoCategoria) return true;
    if ((notasValue || "") !== (categoria.notas || "")) return true;
    if (tiposPlanes.length !== originalTipos.length) return true;
    if (planes.length !== originalPlanes.length) return true;
    for (let i = 0; i < tiposPlanes.length; i++) {
      const curr = tiposPlanes[i];
      const orig = originalTipos[i];
      if (!orig || curr.id !== orig.id || curr.nombre !== orig.nombre)
        return true;
    }
    for (let i = 0; i < planes.length; i++) {
      const curr = planes[i];
      const orig = originalPlanes[i];
      if (
        !orig ||
        curr.id !== orig.id ||
        curr.nombre !== orig.nombre ||
        curr.precio !== orig.precio ||
        curr.cicloPago !== orig.cicloPago ||
        curr.tipoPlan !== orig.tipoPlan
      )
        return true;
    }
    return false;
  }, [
    mode,
    categoria,
    nombreValue,
    tipoValue,
    tipoCategoriaValue,
    notasValue,
    planes,
    tiposPlanes,
  ]);

  useEffect(() => {
    if (nombreValue && nombreValue.length >= 2 && errors.nombre)
      clearErrors("nombre");
  }, [nombreValue, errors.nombre, clearErrors]);

  useEffect(() => {
    if (tipoValue && errors.tipo) clearErrors("tipo");
  }, [tipoValue, errors.tipo, clearErrors]);

  useEffect(() => {
    if (tipoCategoriaValue && errors.tipoCategoria)
      clearErrors("tipoCategoria");
  }, [tipoCategoriaValue, errors.tipoCategoria, clearErrors]);

  // ========================
  // Tipos de plan handlers
  // ========================
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
      id: `tipo-${Date.now()}`,
      nombre: trimmed,
    };
    setTiposPlanes((prev) => [...prev, nuevoTipo]);
    setTipoSeleccionadoId(nuevoTipo.id);
    setNuevoTipoNombre("");
    setTipoNombreError("");
    setShowNuevoTipoInput(false);
    setPlanesError("");
  };

  const handleEliminarTipo = (tipoId: string) => {
    const remaining = tiposPlanes.filter((t) => t.id !== tipoId);
    setTiposPlanes(remaining);
    setPlanes((prev) => prev.filter((p) => p.tipoPlan !== tipoId));
    if (tipoSeleccionadoId === tipoId) {
      setTipoSeleccionadoId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleIniciarEdicion = (tipo: TipoPlanConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditandoTipoId(tipo.id);
    setEditTipoNombre(tipo.nombre);
    setEditTipoError("");
  };

  const handleGuardarEdicion = (e?: React.MouseEvent | React.KeyboardEvent) => {
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
    e?: React.MouseEvent | React.KeyboardEvent,
  ) => {
    if (e) e.stopPropagation();
    setEditandoTipoId(null);
  };

  // ========================
  // Planes handlers
  // ========================
  const agregarPlan = (tipoPlanId: string) => {
    const nuevoPlan: Plan = {
      id: `plan-${Date.now()}`,
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

  const getCicloPagoLabel = (ciclo: string) => {
    switch (ciclo) {
      case "mensual":
        return "Mensual";
      case "trimestral":
        return "Trimestral";
      case "semestral":
        return "Semestral";
      case "anual":
        return "Anual";
      default:
        return "Seleccionar período";
    }
  };

  const onSubmit = async (data: FormData) => {
    if (mode === "create") {
      if (tiposPlanes.length === 0) {
        setPlanesError("Debe crear al menos un tipo de plan");
        setActiveTab("planes");
        return;
      }
      if (planes.length === 0) {
        setPlanesError("Debe agregar al menos un plan a la categoría");
        setActiveTab("planes");
        return;
      }
      if (planes.some((plan) => !plan.nombre || plan.nombre.trim() === "")) {
        setPlanesError("Todos los planes deben tener un nombre");
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

  const getAsociadoLabel = (tipo: string) => {
    switch (tipo) {
      case "cliente":
        return "Cliente";
      case "revendedor":
        return "Revendedor";
      case "ambos":
        return "Ambos";
      default:
        return "Seleccionar";
    }
  };

  const getTipoCategoriaLabel = (tipo: string) => {
    switch (tipo) {
      case "plataforma_streaming":
        return "Plataforma de Streaming";
      case "otros":
        return "Otros";
      default:
        return "Seleccionar tipo";
    }
  };

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

        {/* ── Tab 1: General ── */}
        <TabsContent value="general" className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              {...register("nombre")}
              placeholder="Ej: Netflix, Disney+"
              onChange={(e) => {
                const v = e.target.value;
                setValue("nombre", v.charAt(0).toUpperCase() + v.slice(1));
              }}
            />
            {errors.nombre && (
              <p className="text-sm text-red-500">{errors.nombre.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Asociado a</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    type="button"
                  >
                    {getAsociadoLabel(tipoValue)}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  <DropdownMenuItem onClick={() => setValue("tipo", "cliente")}>
                    Cliente
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setValue("tipo", "revendedor")}
                  >
                    Revendedor
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {errors.tipo && (
                <p className="text-sm text-red-500">{errors.tipo.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tipo de Categoría</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    type="button"
                  >
                    {getTipoCategoriaLabel(tipoCategoriaValue)}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  <DropdownMenuItem
                    onClick={() =>
                      setValue("tipoCategoria", "plataforma_streaming")
                    }
                  >
                    Plataforma de Streaming
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setValue("tipoCategoria", "otros")}
                  >
                    Otros
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {errors.tipoCategoria && (
                <p className="text-sm text-red-500">
                  {errors.tipoCategoria.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              {...register("notas")}
              placeholder="Añade notas sobre la categoría..."
              rows={6}
            />
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

        {/* ── Tab 2: Tipos y Planes ── */}
        <TabsContent value="planes" className="space-y-4">
          {planesError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-500">{planesError}</p>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-6">
            {/* ── Columna izquierda: Tipos de plan ── */}
            <div className="lg:w-[260px] shrink-0 space-y-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-semibold">Tipos de Plan</h3>
                <p className="text-xs text-muted-foreground">
                  Crea tus propias categorías de planes
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {tiposPlanes.map((tipo) => {
                  const cantPlanes = planes.filter(
                    (p) => p.tipoPlan === tipo.id,
                  ).length;
                  const isSelected = tipoSeleccionadoId === tipo.id;

                  if (editandoTipoId === tipo.id) {
                    return (
                      <div
                        key={tipo.id}
                        className="p-2 border-2 border-primary/50 rounded-lg bg-background"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Input
                          autoFocus
                          value={editTipoNombre}
                          onChange={(e) => {
                            setEditTipoNombre(e.target.value);
                            setEditTipoError("");
                          }}
                          className="text-sm h-8 mb-2"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleGuardarEdicion(e);
                            }
                            if (e.key === "Escape") {
                              handleCancelarEdicion(e);
                            }
                          }}
                        />
                        {editTipoError && (
                          <p className="text-xs text-red-500 mb-2">
                            {editTipoError}
                          </p>
                        )}
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={handleCancelarEdicion}
                            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleGuardarEdicion}
                            className="h-6 w-6 flex items-center justify-center rounded text-primary hover:bg-primary/10"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={tipo.id}
                      onClick={() => setTipoSeleccionadoId(tipo.id)}
                      className={`group flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium flex-1 truncate">
                        {tipo.nombre}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded">
                        {cantPlanes}
                      </span>
                      <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => handleIniciarEdicion(tipo, e)}
                          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-blue-500 transition-colors"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEliminarTipo(tipo.id);
                          }}
                          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Input para nuevo tipo */}
                {showNuevoTipoInput ? (
                  <div className="space-y-1.5 pt-1">
                    <Input
                      autoFocus
                      value={nuevoTipoNombre}
                      onChange={(e) => {
                        setNuevoTipoNombre(e.target.value);
                        setTipoNombreError("");
                      }}
                      placeholder="Ej: Pantalla Completa"
                      className="text-sm h-9"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAgregarTipo();
                        }
                        if (e.key === "Escape") {
                          setShowNuevoTipoInput(false);
                          setNuevoTipoNombre("");
                          setTipoNombreError("");
                        }
                      }}
                    />
                    {tipoNombreError && (
                      <p className="text-xs text-red-500">{tipoNombreError}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={handleAgregarTipo}
                      >
                        Agregar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs"
                        onClick={() => {
                          setShowNuevoTipoInput(false);
                          setNuevoTipoNombre("");
                          setTipoNombreError("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNuevoTipoInput(true)}
                    className="w-full h-9 border-dashed text-sm gap-1.5 mt-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nuevo Tipo
                  </Button>
                )}
              </div>
            </div>

            {/* Divisor vertical */}
            <div className="hidden lg:block">
              <div className="h-full border-r" />
            </div>

            {/* ── Columna derecha: Planes del tipo seleccionado ── */}
            <div className="flex-1 space-y-4">
              {!tipoActual ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg">
                  <Tag className="h-8 w-8 text-muted-foreground mb-3 opacity-40" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Sin tipo seleccionado
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Crea un tipo de plan a la izquierda para comenzar
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-base font-semibold">
                        Planes — {tipoActual.nombre}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {planesDeTipoActual.length} plan
                        {planesDeTipoActual.length !== 1 ? "es" : ""} para este
                        tipo
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => agregarPlan(tipoActual.id)}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Plan
                    </Button>
                  </div>

                  {planesDeTipoActual.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed rounded-lg bg-muted/10">
                      <p className="text-sm text-muted-foreground">
                        No hay planes para <strong>{tipoActual.nombre}</strong>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Haz clic en &quot;Agregar Plan&quot; para crear el
                        primero
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {planesDeTipoActual.map((plan, index) => (
                        <div
                          key={plan.id}
                          className="p-4 border rounded-lg bg-card space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm">
                              Plan {index + 1}
                            </h4>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => eliminarPlan(plan.id)}
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`plan-nombre-${plan.id}`}>
                                Nombre del Plan
                              </Label>
                              <Input
                                id={`plan-nombre-${plan.id}`}
                                value={plan.nombre}
                                onChange={(e) =>
                                  actualizarPlan(
                                    plan.id,
                                    "nombre",
                                    e.target.value,
                                  )
                                }
                                placeholder="Ej: Mensual, Premium"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`plan-precio-${plan.id}`}>
                                Precio
                              </Label>
                              <Input
                                id={`plan-precio-${plan.id}`}
                                type="text"
                                inputMode="decimal"
                                value={plan.precio === 0 ? "" : plan.precio.toString()}
                                onChange={(e) => {
                                  const val = e.target.value.replace(',', '.');
                                  if (/^\d*\.?\d*$/.test(val)) {
                                    const parsed = parseFloat(val);
                                    actualizarPlan(
                                      plan.id,
                                      "precio",
                                      isNaN(parsed) ? 0 : parsed,
                                    );
                                    // Para que el input mantenga el "." mientras se escribe,
                                    // necesitamos que el estado sea un string o manejarlo localmente.
                                    // Dado que actualizarPlan actualiza el estado del padre,
                                    // si el padre guarda un number, el "." se perderá en el re-render.
                                    // Pero vamos a intentar forzar el valor del input si termina en "."
                                    if (val.endsWith('.')) {
                                      e.target.value = val;
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  const val = e.target.value.replace(',', '.');
                                  actualizarPlan(plan.id, "precio", parseFloat(val) || 0);
                                }}
                                placeholder="$0.00"
                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`plan-ciclo-${plan.id}`}>
                                Período de Tiempo
                              </Label>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="w-full justify-between"
                                    type="button"
                                  >
                                    {getCicloPagoLabel(plan.cicloPago)}
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="start"
                                  className="w-[var(--radix-dropdown-menu-trigger-width)]"
                                >
                                  <DropdownMenuItem
                                    onClick={() =>
                                      actualizarPlan(
                                        plan.id,
                                        "cicloPago",
                                        "mensual",
                                      )
                                    }
                                  >
                                    Mensual
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      actualizarPlan(
                                        plan.id,
                                        "cicloPago",
                                        "trimestral",
                                      )
                                    }
                                  >
                                    Trimestral
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      actualizarPlan(
                                        plan.id,
                                        "cicloPago",
                                        "semestral",
                                      )
                                    }
                                  >
                                    Semestral
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      actualizarPlan(
                                        plan.id,
                                        "cicloPago",
                                        "anual",
                                      )
                                    }
                                  >
                                    Anual
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveTab("general")}
            >
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
                  ? "Crear Categoría"
                  : "Guardar Cambios"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </form>
  );
}
