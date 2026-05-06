import type { KeyboardEvent, MouseEvent } from "react";

import type { Plan, TipoPlanConfig } from "@/types";

import { CategoriaPlanesActions } from "./CategoriaFormActions";
import { CategoriaPlansPanel } from "./CategoriaPlansPanel";
import { CategoriaPlanTypesPanel } from "./CategoriaPlanTypesPanel";

interface CategoriaPlansSectionProps {
  editTipoError: string;
  editTipoNombre: string;
  editandoTipoId: string | null;
  hasChanges: boolean;
  isEditMode: boolean;
  isSubmitting: boolean;
  nuevoTipoNombre: string;
  planes: Plan[];
  planesDeTipoActual: Plan[];
  planesError: string;
  showNuevoTipoInput: boolean;
  tipoActual?: TipoPlanConfig;
  tipoNombreError: string;
  tipoSeleccionadoId: string | null;
  tiposPlanes: TipoPlanConfig[];
  onAddPlan: (tipoPlanId: string) => void;
  onAddTipo: () => void;
  onCancelEdit: (
    event?: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLInputElement>,
  ) => void;
  onCancelNewTipo: () => void;
  onDeletePlan: (id: string) => void;
  onDeleteTipo: (tipoId: string) => void;
  onPrevious: () => void;
  onSaveEdit: (
    event?: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLInputElement>,
  ) => void;
  onSelectTipo: (tipoId: string) => void;
  onStartEdit: (
    tipo: TipoPlanConfig,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  onUpdatePlan: (id: string, campo: keyof Plan, valor: string | number) => void;
  setEditTipoError: (value: string) => void;
  setEditTipoNombre: (value: string) => void;
  setNuevoTipoNombre: (value: string) => void;
  setShowNuevoTipoInput: (value: boolean) => void;
  setTipoNombreError: (value: string) => void;
}

export function CategoriaPlansSection({
  editTipoError,
  editTipoNombre,
  editandoTipoId,
  hasChanges,
  isEditMode,
  isSubmitting,
  nuevoTipoNombre,
  planes,
  planesDeTipoActual,
  planesError,
  showNuevoTipoInput,
  tipoActual,
  tipoNombreError,
  tipoSeleccionadoId,
  tiposPlanes,
  onAddPlan,
  onAddTipo,
  onCancelEdit,
  onCancelNewTipo,
  onDeletePlan,
  onDeleteTipo,
  onPrevious,
  onSaveEdit,
  onSelectTipo,
  onStartEdit,
  onUpdatePlan,
  setEditTipoError,
  setEditTipoNombre,
  setNuevoTipoNombre,
  setShowNuevoTipoInput,
  setTipoNombreError,
}: CategoriaPlansSectionProps) {
  return (
    <div className="space-y-4">
      {planesError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-500">{planesError}</p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <CategoriaPlanTypesPanel
          editTipoError={editTipoError}
          editTipoNombre={editTipoNombre}
          editandoTipoId={editandoTipoId}
          nuevoTipoNombre={nuevoTipoNombre}
          planes={planes}
          showNuevoTipoInput={showNuevoTipoInput}
          tipoNombreError={tipoNombreError}
          tipoSeleccionadoId={tipoSeleccionadoId}
          tiposPlanes={tiposPlanes}
          onAddTipo={onAddTipo}
          onCancelEdit={onCancelEdit}
          onCancelNewTipo={onCancelNewTipo}
          onDeleteTipo={onDeleteTipo}
          onSaveEdit={onSaveEdit}
          onSelectTipo={onSelectTipo}
          onStartEdit={onStartEdit}
          setEditTipoError={setEditTipoError}
          setEditTipoNombre={setEditTipoNombre}
          setNuevoTipoNombre={setNuevoTipoNombre}
          setShowNuevoTipoInput={setShowNuevoTipoInput}
          setTipoNombreError={setTipoNombreError}
        />

        <div className="hidden lg:block">
          <div className="h-full border-r" />
        </div>

        <CategoriaPlansPanel
          planesDeTipoActual={planesDeTipoActual}
          tipoActual={tipoActual}
          onAddPlan={onAddPlan}
          onDeletePlan={onDeletePlan}
          onUpdatePlan={onUpdatePlan}
        />
      </div>

      <CategoriaPlanesActions
        hasChanges={hasChanges}
        isEditMode={isEditMode}
        isSubmitting={isSubmitting}
        onPrevious={onPrevious}
      />
    </div>
  );
}
