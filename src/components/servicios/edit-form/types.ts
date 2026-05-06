import type { Dispatch, SetStateAction } from "react";
import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";

import type { ServicioEditFormData } from "./schema";

export interface ServicioEditFormBindings {
  errors: FieldErrors<ServicioEditFormData>;
  register: UseFormRegister<ServicioEditFormData>;
  setValue: UseFormSetValue<ServicioEditFormData>;
}

export type FechaPopoverSetter = Dispatch<SetStateAction<boolean>>;
