import { Button } from "@/components/ui/button";

interface CategoriaGeneralActionsProps {
  onCancel: () => void;
  onNext: () => void;
}

interface CategoriaPlanesActionsProps {
  hasChanges: boolean;
  isEditMode: boolean;
  isSubmitting: boolean;
  onPrevious: () => void;
}

export function CategoriaGeneralActions({
  onCancel,
  onNext,
}: CategoriaGeneralActionsProps) {
  return (
    <div className="flex gap-3 justify-end pt-6">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="button" onClick={onNext}>
        Siguiente
      </Button>
    </div>
  );
}

export function CategoriaPlanesActions({
  hasChanges,
  isEditMode,
  isSubmitting,
  onPrevious,
}: CategoriaPlanesActionsProps) {
  return (
    <div className="flex gap-3 justify-end pt-4">
      <Button type="button" variant="outline" onClick={onPrevious}>
        Anterior
      </Button>
      <Button type="submit" disabled={isSubmitting || (isEditMode && !hasChanges)}>
        {isSubmitting
          ? isEditMode
            ? "Guardando..."
            : "Creando..."
          : isEditMode
            ? "Guardar Cambios"
            : "Crear Categoría"}
      </Button>
    </div>
  );
}
