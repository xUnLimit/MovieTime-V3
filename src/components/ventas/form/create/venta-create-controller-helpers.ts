import { deliveryPassword } from '@/platform/utils/code-access';
import {
  SERVICIOS_DROPDOWN_VISIBLE_ROWS,
  type TipoVentaItem,
  type VentaItem,
  type VentaItemErrors,
} from "@/components/ventas/form/ventas-form-shared";
import type { VentaFormData } from "@/components/ventas/form/venta-form-schema";
import { PENDING_TERCERO_PAYMENT_ID } from "@/platform/utils/terceroMetodoPago";
import { PROFILE_PAGE_SIZE } from "@/platform/utils/perfiles";
import { normalizePhoneSearch, normalizeSearchText } from "@/platform/utils";
import type { Categoria, Plan, Servicio, Tercero } from "@/types";

import { createClientId } from "./venta-create-id";

export function sortTercerosByNewest(terceros: Tercero[]): Tercero[] {
  return [...terceros].sort((a, b) => {
    const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bDate - aDate;
  });
}

export function filterTercerosBySearch(
  terceros: Tercero[],
  searchCliente: string,
): Tercero[] {
  if (!searchCliente) return terceros;
  const search = normalizeSearchText(searchCliente);
  const phoneQuery = normalizePhoneSearch(searchCliente);

  return terceros.filter((tercero) => {
    const nombreCompleto = normalizeSearchText(
      `${tercero.nombre} ${tercero.apellido || ""}`,
    );
    const telefono = normalizePhoneSearch(tercero.telefono);
    return (
      nombreCompleto.includes(search) ||
      (phoneQuery.length > 0 && telefono.includes(phoneQuery))
    );
  });
}

export function sortServiciosByNewest(servicios: Servicio[]): Servicio[] {
  return [...servicios].sort((a, b) => {
    const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bDate - aDate;
  });
}

export function sortPaymentMethods<T extends { id: string; nombre: string }>(
  metodos: T[],
): T[] {
  const metodosPendientes = metodos.filter(
    (metodo) => metodo.id === PENDING_TERCERO_PAYMENT_ID,
  );
  const metodosReales = metodos
    .filter((metodo) => metodo.id !== PENDING_TERCERO_PAYMENT_ID)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return [...metodosPendientes, ...metodosReales];
}

export function getPerfilesUsados(items: VentaItem[]) {
  return items.reduce<Record<string, Set<number>>>((acc, item) => {
    if (!item.perfilNumero) return acc;
    if (!acc[item.servicioId]) acc[item.servicioId] = new Set<number>();
    acc[item.servicioId].add(item.perfilNumero);
    return acc;
  }, {});
}

export function getSlotsDisponiblesForServicio({
  perfilesOcupadosVenta,
  perfilesUsados,
  servicio,
}: {
  perfilesOcupadosVenta: Record<string, Set<number>>;
  perfilesUsados: Record<string, Set<number>>;
  servicio: Servicio | undefined;
}) {
  if (!servicio) return 0;

  const ocupadosEnVenta = perfilesUsados[servicio.id]?.size || 0;
  const ocupadosReales = perfilesOcupadosVenta[servicio.id];
  if (ocupadosReales !== undefined) {
    return Math.max(
      (servicio.perfilesDisponibles || 0) -
        ocupadosReales.size -
        ocupadosEnVenta,
      0,
    );
  }

  return Math.max(
    (servicio.perfilesDisponibles || 0) -
      (servicio.perfilesOcupados || 0) -
      ocupadosEnVenta,
    0,
  );
}

export function getPerfilesDropdown({
  perfilesOcupadosVenta,
  perfilesUsados,
  servicioId,
  servicioSeleccionado,
}: {
  perfilesOcupadosVenta: Record<string, Set<number>>;
  perfilesUsados: Record<string, Set<number>>;
  servicioId: string;
  servicioSeleccionado: Servicio | undefined;
}) {
  if (!servicioId) return [];

  const totalPerfiles = servicioSeleccionado?.perfilesDisponibles || 0;
  if (totalPerfiles <= 0) return [];

  const ocupados = perfilesUsados[servicioId] ?? new Set<number>();
  const ocupadosEnVentas = perfilesOcupadosVenta[servicioId] ?? new Set<number>();
  const isDisponible = (numero: number) =>
    !ocupados.has(numero) && !ocupadosEnVentas.has(numero);

  if (totalPerfiles <= PROFILE_PAGE_SIZE) {
    return Array.from({ length: totalPerfiles }, (_, index) => index + 1).filter(
      isDisponible,
    );
  }

  const bloqueTamano = 5;
  const totalBloques = Math.ceil(totalPerfiles / bloqueTamano);

  for (let bloque = 0; bloque < totalBloques; bloque++) {
    const inicio = bloque * bloqueTamano + 1;
    const fin = Math.min(inicio + bloqueTamano - 1, totalPerfiles);
    const disponiblesBloque = Array.from(
      { length: fin - inicio + 1 },
      (_, index) => inicio + index,
    ).filter(isDisponible);

    if (disponiblesBloque.length > 0) return disponiblesBloque;
  }

  return [];
}

export { getDisponiblesColorClass } from "@/components/shared/disponibilidad-status";

export function getServiciosDropdownWindow(
  servicios: Servicio[],
  start: number,
) {
  return servicios.slice(
    start,
    start + SERVICIOS_DROPDOWN_VISIBLE_ROWS,
  );
}

export type VentaCreateDatosStepField =
  | "clienteId"
  | "metodoPagoId"
  | "fechaInicio"
  | "fechaFin";

export function validateVentaCreateDatosStep({
  clienteId,
  fechaFin,
  fechaInicio,
  metodoPagoId,
}: Pick<
  VentaFormData,
  VentaCreateDatosStepField
>): Partial<Record<VentaCreateDatosStepField, string>> {
  const errors: Partial<Record<VentaCreateDatosStepField, string>> = {};

  if (!clienteId) errors.clienteId = "Seleccione un cliente";
  if (!metodoPagoId) errors.metodoPagoId = "Seleccione un metodo de pago";
  if (!fechaInicio) errors.fechaInicio = "Seleccione fecha de inicio";
  if (!fechaFin) errors.fechaFin = "Seleccione fecha de fin";

  return errors;
}

export function buildVentaItem({
  categoria,
  codigo,
  descuento,
  fechaFin,
  fechaInicio,
  notas,
  perfilNombre,
  perfilNumero,
  plan,
  precio,
  precioFinal,
  servicioId,
  servicioSeleccionado,
  tipo,
}: {
  categoria: Categoria;
  codigo?: string;
  descuento: number;
  fechaFin?: Date;
  fechaInicio?: Date;
  notas?: string;
  perfilNombre?: string;
  perfilNumero?: number;
  plan: Plan;
  precio: number;
  precioFinal: number;
  servicioId: string;
  servicioSeleccionado?: Servicio;
  tipo: TipoVentaItem;
}): VentaItem {
  const planTipoNombre = categoria.tiposPlanes?.find(
    (tipoPlan) => tipoPlan.id === plan.tipoPlan,
  )?.nombre;

  return {
    id: `${servicioId}-${plan.id}-${Date.now()}`,
    itemId: createClientId(),
    tipo,
    planId: plan.id,
    planNombre: plan.nombre,
    planTipoNombre,
    categoriaId: categoria.id,
    categoriaNombre: categoria.nombre,
    servicioId,
    servicioNombre: servicioSeleccionado?.nombre || plan.nombre,
    servicioCorreo: servicioSeleccionado?.correo,
    servicioContrasena: deliveryPassword(servicioSeleccionado?.contrasena, servicioSeleccionado?.accesoPorCodigo),
    cicloPago: plan.cicloPago,
    fechaInicio,
    fechaFin,
    perfilNumero,
    perfilNombre: perfilNombre?.trim() || undefined,
    precio,
    descuento,
    precioFinal,
    codigo,
    notas,
  };
}

export function validateVentaItemSelection({
  categoriaId,
  perfilNumero,
  perfilesOcupadosVenta,
  perfilesUsados,
  plan,
  precio,
  servicioId,
  slotsDisponibles,
}: {
  categoriaId: string;
  perfilNumero: string;
  perfilesOcupadosVenta: Record<string, Set<number>>;
  perfilesUsados: Record<string, Set<number>>;
  plan?: Plan;
  precio: string;
  servicioId: string;
  slotsDisponibles: number;
}): VentaItemErrors {
  const errors: VentaItemErrors = {};

  if (!categoriaId) {
    errors.categoria = "Seleccione una categoria";
  }
  if (!servicioId) {
    errors.servicio = "Seleccione un servicio";
  }
  if (!plan) {
    errors.plan = "Seleccione un plan";
  }
  if (!precio || Number(precio) <= 0) {
    errors.precio = "Ingrese un precio valido";
  }

  if (!perfilNumero) {
    errors.perfil = "Seleccione el numero de perfil";
  } else if (slotsDisponibles <= 0) {
    errors.perfil = "No hay perfiles disponibles";
  } else if (perfilesUsados[servicioId]?.has(Number(perfilNumero))) {
    errors.perfil = "Ese perfil ya fue agregado";
  } else if (perfilesOcupadosVenta[servicioId]?.has(Number(perfilNumero))) {
    errors.perfil = "Ese perfil ya esta ocupado";
  }

  return errors;
}

