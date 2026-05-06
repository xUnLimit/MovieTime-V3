import type { Dispatch, SetStateAction } from "react";
import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";

import type { ServicioFormData } from "@/features/servicios/servicio-form-schema";

export interface ServicioFormBindings {
  errors: FieldErrors<ServicioFormData>;
  register: UseFormRegister<ServicioFormData>;
  setValue: UseFormSetValue<ServicioFormData>;
}

export type FechaPopoverSetter = Dispatch<SetStateAction<boolean>>;
