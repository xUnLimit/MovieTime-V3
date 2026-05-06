import type { KeyboardEvent, MouseEvent } from "react";
import { Check, Edit, Plus, Tag, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Plan, TipoPlanConfig } from "@/types";

interface CategoriaPlanTypesPanelProps {
  editTipoError: string;
  editTipoNombre: string;
  editandoTipoId: string | null;
  nuevoTipoNombre: string;
  planes: Plan[];
  showNuevoTipoInput: boolean;
  tipoNombreError: string;
  tipoSeleccionadoId: string | null;
  tiposPlanes: TipoPlanConfig[];
  onAddTipo: () => void;
  onCancelEdit: (
    event?: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLInputElement>,
  ) => void;
  onCancelNewTipo: () => void;
  onDeleteTipo: (tipoId: string) => void;
  onSaveEdit: (
    event?: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLInputElement>,
  ) => void;
  onSelectTipo: (tipoId: string) => void;
  onStartEdit: (
    tipo: TipoPlanConfig,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  setEditTipoError: (value: string) => void;
  setEditTipoNombre: (value: string) => void;
  setNuevoTipoNombre: (value: string) => void;
  setShowNuevoTipoInput: (value: boolean) => void;
  setTipoNombreError: (value: string) => void;
}

export function CategoriaPlanTypesPanel({
  editTipoError,
  editTipoNombre,
  editandoTipoId,
  nuevoTipoNombre,
  planes,
  showNuevoTipoInput,
  tipoNombreError,
  tipoSeleccionadoId,
  tiposPlanes,
  onAddTipo,
  onCancelEdit,
  onCancelNewTipo,
  onDeleteTipo,
  onSaveEdit,
  onSelectTipo,
  onStartEdit,
  setEditTipoError,
  setEditTipoNombre,
  setNuevoTipoNombre,
  setShowNuevoTipoInput,
  setTipoNombreError,
}: CategoriaPlanTypesPanelProps) {
  return (
    <div className="lg:w-[260px] shrink-0 space-y-3">
      <div className="space-y-0.5">
        <h3 className="text-base font-semibold">Tipos de Plan</h3>
        <p className="text-xs text-muted-foreground">
          Crea tus propias categorías de planes
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {tiposPlanes.map((tipo) => {
          const cantPlanes = planes.filter((p) => p.tipoPlan === tipo.id).length;
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
                      onSaveEdit(e);
                    }
                    if (e.key === "Escape") {
                      onCancelEdit(e);
                    }
                  }}
                />
                {editTipoError && (
                  <p className="text-xs text-red-500 mb-2">{editTipoError}</p>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onSaveEdit}
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
              onClick={() => onSelectTipo(tipo.id)}
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
                  onClick={(e) => onStartEdit(tipo, e)}
                  className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-blue-500 transition-colors"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTipo(tipo.id);
                  }}
                  className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}

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
                  onAddTipo();
                }
                if (e.key === "Escape") {
                  onCancelNewTipo();
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
                onClick={onAddTipo}
              >
                Agregar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs"
                onClick={onCancelNewTipo}
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
  );
}
