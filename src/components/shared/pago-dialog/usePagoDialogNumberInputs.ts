import { useState } from "react";

export function usePagoDialogNumberInputs() {
  const [isCostoFocused, setIsCostoFocused] = useState(false);
  const [isDescuentoFocused, setIsDescuentoFocused] = useState(false);
  const [costoInput, setCostoInput] = useState("");
  const [descuentoInput, setDescuentoInput] = useState("");

  return {
    costoInput,
    descuentoInput,
    isCostoFocused,
    isDescuentoFocused,
    setCostoInput,
    setDescuentoInput,
    setIsCostoFocused,
    setIsDescuentoFocused,
  };
}
