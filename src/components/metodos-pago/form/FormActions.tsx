import { Button } from "@/components/ui/button";
import type { MetodoPagoFormMode } from "./helpers";

interface BasicFormActionsProps {
  onCancel: () => void;
  onNext: () => void;
}

export function BasicFormActions({ onCancel, onNext }: BasicFormActionsProps) {
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

interface AdditionalFormActionsProps {
  mode: MetodoPagoFormMode;
  isSubmitting: boolean;
  hasChanges: boolean;
  onPrevious: () => void;
}

export function AdditionalFormActions({
  mode,
  isSubmitting,
  hasChanges,
  onPrevious,
}: AdditionalFormActionsProps) {
  return (
    <div className="flex gap-3 justify-end pt-4">
      <Button type="button" variant="outline" onClick={onPrevious}>
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
            ? "Crear Método de Pago"
            : "Guardar Cambios"}
      </Button>
    </div>
  );
}
