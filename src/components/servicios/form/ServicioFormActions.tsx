import { Button } from "@/components/ui/button";

interface ServicioDatosFooterActionsProps {
  onCancel: () => void;
  onNext: () => void;
}

interface ServicioPreviewFooterActionsProps {
  hasChanges: boolean;
  isEditMode: boolean;
  isSubmitting: boolean;
  onPrevious: () => void;
}

export function ServicioDatosFooterActions({
  onCancel,
  onNext,
}: ServicioDatosFooterActionsProps) {
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

export function ServicioPreviewFooterActions({
  hasChanges,
  isEditMode,
  isSubmitting,
  onPrevious,
}: ServicioPreviewFooterActionsProps) {
  return (
    <div className="flex gap-3 justify-end pt-6">
      <Button type="button" variant="outline" onClick={onPrevious}>
        Anterior
      </Button>
      <Button type="submit" disabled={isSubmitting || !hasChanges}>
        {isSubmitting
          ? isEditMode
            ? "Actualizando..."
            : "Creando..."
          : isEditMode
            ? "Guardar Cambios"
            : "Crear Servicio"}
      </Button>
    </div>
  );
}
