import { useMemo, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

import type { Categoria, Plan, TipoPlanConfig } from "@/types";

import { createCategoriaClientId } from "./categoria-form-id";

interface UseCategoriaPlansStateArgs {
  categoria?: Categoria;
  mode: "create" | "edit";
}

export function useCategoriaPlansState({
  categoria,
  mode,
}: UseCategoriaPlansStateArgs) {
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

  const handleAgregarTipo = () => {
    const trimmed = nuevoTipoNombre.trim();
    if (!trimmed) {
      setTipoNombreError("El nombre no puede estar vacio");
      return;
    }
    if (
      tiposPlanes.some((t) => t.nombre.toLowerCase() === trimmed.toLowerCase())
    ) {
      setTipoNombreError("Ya existe un tipo con ese nombre");
      return;
    }

    const nuevoTipo: TipoPlanConfig = {
      id: createCategoriaClientId(),
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
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    setEditandoTipoId(tipo.id);
    setEditTipoNombre(tipo.nombre);
    setEditTipoError("");
  };

  const handleGuardarEdicion = (
    event?: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event) event.stopPropagation();
    const trimmed = editTipoNombre.trim();
    if (!trimmed) {
      setEditTipoError("El nombre no puede estar vacio");
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
    event?: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event) event.stopPropagation();
    setEditandoTipoId(null);
  };

  const agregarPlan = (tipoPlanId: string) => {
    const nuevoPlan: Plan = {
      id: createCategoriaClientId(),
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

  return {
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
  };
}
