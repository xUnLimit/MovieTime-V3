import { Button } from "@/components/ui/button";

interface VentaFormActionsProps {
  activeTab: "datos" | "preview";
  cancelLabel?: string;
  submitLabel: string;
  submitDisabled?: boolean;
  onCancel: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export function VentaFormActions({
  activeTab,
  cancelLabel = "Cancelar",
  submitLabel,
  submitDisabled = false,
  onCancel,
  onPrevious,
  onNext,
}: VentaFormActionsProps) {
  return (
    <div className="flex justify-end gap-3">
      {activeTab === "preview" ? (
        <>
          <Button type="button" variant="outline" onClick={onPrevious}>
            Anterior
          </Button>
          <Button type="submit" disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </>
      ) : (
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              onNext();
            }}
          >
            Siguiente
          </Button>
        </>
      )}
    </div>
  );
}
