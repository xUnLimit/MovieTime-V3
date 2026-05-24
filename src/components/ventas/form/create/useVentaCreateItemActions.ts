import type { Dispatch, SetStateAction } from 'react';
import type { UseFormSetValue } from 'react-hook-form';

import type { VentaFormData } from '@/features/ventas/venta-form-schema';
import type {
  TipoVentaItem,
  VentaItem,
  VentaItemErrors,
} from '@/features/ventas/ventas-form-shared';
import type { Categoria, Plan, Servicio } from '@/types';

import {
  buildVentaItem,
  validateVentaItemSelection,
} from './venta-create-controller-helpers';

type UseVentaCreateItemActionsParams = {
  categoriaId: string;
  categorias: Categoria[];
  codigo: string | undefined;
  descuentoNumero: number;
  fechaFin: Date | undefined;
  fechaInicio: Date | undefined;
  getSlotsDisponibles: (servicioId: string) => number;
  notasItem: string;
  perfilNombre: string;
  perfilNumero: string;
  perfilesOcupadosVenta: Record<string, Set<number>>;
  perfilesUsados: Record<string, Set<number>>;
  planId: string;
  planesDisponibles: Plan[];
  precio: string;
  precioBase: number;
  precioFinalNumero: number;
  servicioId: string;
  servicioSeleccionado: Servicio | undefined;
  setCategoriaId: Dispatch<SetStateAction<string>>;
  setDescuento: Dispatch<SetStateAction<string>>;
  setItemErrors: Dispatch<SetStateAction<VentaItemErrors>>;
  setItems: Dispatch<SetStateAction<VentaItem[]>>;
  setNotasItem: Dispatch<SetStateAction<string>>;
  setPerfilNombre: Dispatch<SetStateAction<string>>;
  setPerfilNumero: Dispatch<SetStateAction<string>>;
  setPlanId: Dispatch<SetStateAction<string>>;
  setPrecio: Dispatch<SetStateAction<string>>;
  setServicioId: Dispatch<SetStateAction<string>>;
  setTipoPlanId: Dispatch<SetStateAction<string>>;
  setValue: UseFormSetValue<VentaFormData>;
  tipoItem: TipoVentaItem | null;
};

export function useVentaCreateItemActions({
  categoriaId,
  categorias,
  codigo,
  descuentoNumero,
  fechaFin,
  fechaInicio,
  getSlotsDisponibles,
  notasItem,
  perfilNombre,
  perfilNumero,
  perfilesOcupadosVenta,
  perfilesUsados,
  planId,
  planesDisponibles,
  precio,
  precioBase,
  precioFinalNumero,
  servicioId,
  servicioSeleccionado,
  setCategoriaId,
  setDescuento,
  setItemErrors,
  setItems,
  setNotasItem,
  setPerfilNombre,
  setPerfilNumero,
  setPlanId,
  setPrecio,
  setServicioId,
  setTipoPlanId,
  setValue,
  tipoItem,
}: UseVentaCreateItemActionsParams) {
  const resetItemDraft = () => {
    setCategoriaId('');
    setTipoPlanId('');
    setServicioId('');
    setPlanId('');
    setPrecio('');
    setDescuento('');
    setPerfilNumero('');
    setPerfilNombre('');
    setValue('codigo', '');
    setNotasItem('');
    setItemErrors({});
  };

  const handleAddItem = () => {
    const categoria = categorias.find((item) => item.id === categoriaId);
    const plan = planesDisponibles.find((item) => item.id === planId);
    const trimmedCodigo = codigo?.trim();
    const errors = validateVentaItemSelection({
      categoriaId,
      perfilNumero,
      perfilesOcupadosVenta,
      perfilesUsados,
      plan,
      precio,
      servicioId,
      slotsDisponibles: getSlotsDisponibles(servicioId),
    });
    if (Object.keys(errors).length > 0) {
      setItemErrors(errors);
      return;
    }
    setItemErrors({});
    if (!plan || !categoria || !tipoItem) return;
    const newItem = buildVentaItem({
      categoria,
      codigo: trimmedCodigo ? trimmedCodigo : undefined,
      descuento: descuentoNumero,
      fechaFin: fechaFin ? new Date(fechaFin) : undefined,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined,
      notas: notasItem?.trim() ? notasItem.trim() : undefined,
      perfilNombre,
      perfilNumero: perfilNumero ? Number(perfilNumero) : undefined,
      plan,
      precio: precioBase,
      precioFinal: precioFinalNumero,
      servicioId,
      servicioSeleccionado,
      tipo: tipoItem,
    });

    setItems((prev) => [...prev, newItem]);
    resetItemDraft();
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleEditItem = (item: VentaItem) => {
    handleRemoveItem(item.id);

    const itemCategoria = categorias.find(
      (categoria) => categoria.id === item.categoriaId,
    );
    const itemPlan = itemCategoria?.planes?.find((plan) => plan.id === item.planId);

    setCategoriaId(item.categoriaId);
    setTipoPlanId(itemPlan?.tipoPlan ?? '');
    setServicioId(item.servicioId);
    setPlanId(item.planId);
    setPrecio(item.precio.toString());
    setDescuento(item.descuento.toString());

    if (item.perfilNumero) setPerfilNumero(item.perfilNumero.toString());
    if (item.perfilNombre) setPerfilNombre(item.perfilNombre);
    setValue('codigo', item.codigo || '');
    setNotasItem(item.notas || '');
    if (item.fechaInicio) setValue('fechaInicio', item.fechaInicio);
    if (item.fechaFin) setValue('fechaFin', item.fechaFin);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return {
    handleAddItem,
    handleEditItem,
    handleRemoveItem,
  };
}
