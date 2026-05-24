import type { Dispatch, SetStateAction } from 'react';
import type {
  FieldErrors,
  UseFormClearErrors,
  UseFormRegister,
  UseFormSetValue,
} from 'react-hook-form';

import type { PagoDialogFormData } from './schema';

export type FormSetValue = UseFormSetValue<PagoDialogFormData>;
export type FormClearErrors = UseFormClearErrors<PagoDialogFormData>;
export type FormErrors = FieldErrors<PagoDialogFormData>;
export type FormRegister = UseFormRegister<PagoDialogFormData>;
export type StateSetter<T> = Dispatch<SetStateAction<T>>;
