import type { Dispatch, SetStateAction } from 'react';
import type { UseFormClearErrors, UseFormSetValue } from 'react-hook-form';
import { addMonths } from 'date-fns';

import type { VentaFormData } from '@/features/ventas/venta-form-schema';
import {
  MESES_POR_CICLO,
  type VentaItemErrors,
} from '@/features/ventas/ventas-form-shared';
import type { Plan, Servicio } from '@/types';

type UseVentaCreateSelectionHandlersParams = {
  clearErrors: UseFormClearErrors<VentaFormData>;
  fechaInicio: Date | undefined;
  planSeleccionado: Plan | undefined;
  setCategoriaId: Dispatch<SetStateAction<string>>;
  setDescuento: Dispatch<SetStateAction<string>>;
  setItemErrors: Dispatch<SetStateAction<VentaItemErrors>>;
  setNotasItem: Dispatch<SetStateAction<string>>;
  setPerfilNombre: Dispatch<SetStateAction<string>>;
  setPerfilNumero: Dispatch<SetStateAction<string>>;
  setPlanId: Dispatch<SetStateAction<string>>;
  setPrecio: Dispatch<SetStateAction<string>>;
  setServicioId: Dispatch<SetStateAction<string>>;
  setTipoPlanId: Dispatch<SetStateAction<string>>;
  setValue: UseFormSetValue<VentaFormData>;
};

export function useVentaCreateSelectionHandlers({
  clearErrors,
  fechaInicio,
  planSeleccionado,
  setCategoriaId,
  setDescuento,
  setItemErrors,
  setNotasItem,
  setPerfilNombre,
  setPerfilNumero,
  setPlanId,
  setPrecio,
  setServicioId,
  setTipoPlanId,
  setValue,
}: UseVentaCreateSelectionHandlersParams) {
  const handleSelectCategoria = (nextCategoriaId: string) => {
    setCategoriaId(nextCategoriaId);
    setTipoPlanId('');
    setServicioId('');
    setPlanId('');
    setPrecio('');
    setDescuento('');
    setPerfilNumero('');
    setPerfilNombre('');
    setNotasItem('');
    setItemErrors((prev) => ({
      ...prev,
      categoria: undefined,
    }));
  };

  const handleSelectTipoPlan = (id: string) => {
    setTipoPlanId(id);
    setPlanId('');
    setServicioId('');
    setPerfilNumero('');
    setPerfilNombre('');
    setPrecio('');
    setItemErrors((prev) => ({
      ...prev,
      plan: undefined,
      servicio: undefined,
      perfil: undefined,
    }));
  };

  const handleSelectServicio = (servicio: Servicio) => {
    setServicioId(servicio.id);
    setPerfilNumero('');
    setPerfilNombre('');
    setItemErrors((prev) => ({
      ...prev,
      servicio: undefined,
      perfil: undefined,
    }));
  };

  const handleSelectPlan = (plan: Plan) => {
    setPlanId(plan.id);
    setServicioId('');
    setPerfilNumero('');
    setPerfilNombre('');
    setPrecio(plan.precio.toFixed(2));
    setItemErrors((prev) => ({
      ...prev,
      plan: undefined,
      precio: undefined,
      servicio: undefined,
      perfil: undefined,
    }));
    if (fechaInicio) {
      const meses = MESES_POR_CICLO[plan.cicloPago] ?? 1;
      setValue('fechaFin', addMonths(new Date(fechaInicio), meses));
    }
  };

  const handleSelectPerfil = (numero: number) => {
    setPerfilNumero(String(numero));
    setItemErrors((prev) => ({
      ...prev,
      perfil: undefined,
    }));
  };

  const handlePrecioChange = (value: string) => {
    setPrecio(value);
    setItemErrors((prev) => ({
      ...prev,
      precio: undefined,
    }));
  };

  const handleSelectFechaInicio = (date?: Date) => {
    setValue('fechaInicio', date || new Date());
    clearErrors('fechaInicio');
    if (planSeleccionado && date) {
      const meses = MESES_POR_CICLO[planSeleccionado.cicloPago] ?? 1;
      setValue('fechaFin', addMonths(date, meses));
    }
  };

  const handleSelectFechaFin = (date?: Date) => {
    setValue('fechaFin', date || new Date());
    clearErrors('fechaFin');
  };

  return {
    handlePrecioChange,
    handleSelectCategoria,
    handleSelectFechaFin,
    handleSelectFechaInicio,
    handleSelectPerfil,
    handleSelectPlan,
    handleSelectServicio,
    handleSelectTipoPlan,
  };
}
