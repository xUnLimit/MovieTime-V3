import { Button } from "@/components/ui/button";

interface ServicioEditActionsProps {
  hasChanges: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
}

export function ServicioEditActions({
  hasChanges,
  isSubmitting,
  onCancel,
}: ServicioEditActionsProps) {
  return (
    <div className="flex gap-3 justify-end pt-6">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" disabled={isSubmitting || !hasChanges}>
        {isSubmitting ? "Actualizando..." : "Guardar Cambios"}
      </Button>
    </div>
  );
}
