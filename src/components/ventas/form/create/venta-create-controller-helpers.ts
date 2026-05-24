import {
  SERVICIOS_DROPDOWN_VISIBLE_ROWS,
  type VentaItem,
} from "@/features/ventas/ventas-form-shared";
import { PENDING_TERCERO_PAYMENT_ID } from "@/lib/utils/terceroMetodoPago";
import { PROFILE_PAGE_SIZE } from "@/lib/utils/perfiles";
import { normalizePhoneSearch, normalizeSearchText } from "@/lib/utils";
import type { Servicio, Tercero, VentaDoc } from "@/types";

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

export function getDisponiblesColorClass(disponibles: number, total: number) {
  if (total <= 0) return "text-muted-foreground";
  const ratio = disponibles / total;
  if (ratio <= 0.25) return "text-[#ff1744]";
  if (ratio <= 0.5) return "text-[#ffea00]";
  return "text-[#00ff85]";
}

export function getServiciosDropdownWindow(
  servicios: Servicio[],
  start: number,
) {
  return servicios.slice(
    start,
    start + SERVICIOS_DROPDOWN_VISIBLE_ROWS,
  );
}

export type CreateVentaWriteInput = Omit<VentaDoc, "id" | "createdAt" | "updatedAt">;

function createClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildVentaCreateInput({
  clienteId,
  clienteNombre,
  clienteTelefono,
  estadoVenta,
  fechaFinValue,
  fechaInicioValue,
  item,
  metodoPagoId,
  metodoPagoNombre,
  moneda,
  totalFinal,
  ventaId,
}: {
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string;
  estadoVenta: "activo" | "inactivo";
  fechaFinValue: Date;
  fechaInicioValue: Date;
  item: VentaItem;
  metodoPagoId: string;
  metodoPagoNombre: string;
  moneda: string;
  totalFinal: number;
  ventaId: string;
}): CreateVentaWriteInput {
  const fechaInicio = item.fechaInicio ?? fechaInicioValue;
  const fechaFin = item.fechaFin ?? fechaFinValue;

  return {
    clienteId,
    clienteNombre,
    clienteTelefono,
    metodoPagoId,
    metodoPagoNombre,
    moneda,
    fechaInicio,
    fechaFin,
    codigo: item.codigo || "",
    perfilNombre: item.perfilNombre || "",
    estado: estadoVenta || "activo",
    notas: item.notas || "",
    categoriaId: item.categoriaId,
    categoriaNombre: item.categoriaNombre,
    servicioId: item.servicioId,
    servicioNombre: item.servicioNombre,
    servicioCorreo: item.servicioCorreo ?? "",
    servicioContrasena: item.servicioContrasena ?? "",
    cicloPago: item.cicloPago || "mensual",
    perfilNumero: item.perfilNumero ?? null,
    planId: item.planId,
    planNombre: item.planNombre,
    planTipoNombre: item.planTipoNombre,
    precio: item.precio,
    descuento: item.descuento,
    precioFinal: item.precioFinal,
    pagos: [
      {
        id: createClientId(),
        fecha: new Date(),
        descripcion: "Pago inicial",
        precio: item.precio,
        descuento: item.descuento,
        total: item.precioFinal,
        metodoPagoId,
        metodoPagoNombre,
        moneda,
        isPagoInicial: true,
        cicloPago: item.cicloPago ?? undefined,
        fechaInicio,
        fechaVencimiento: fechaFin,
        notas: item.notas ?? "",
      },
    ],
    itemId: item.itemId,
    ventaId,
    totalVenta: totalFinal,
  };
}
