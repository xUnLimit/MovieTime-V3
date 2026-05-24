import { normalizePhoneSearch, normalizeSearchText } from "@/lib/utils";
import { isPendingTerceroPaymentMethodId } from "@/lib/utils/terceroMetodoPago";
import type { Tercero } from "@/types";

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

export function sortPaymentMethods<T extends { id: string; nombre: string }>(
  metodosPago: T[],
): T[] {
  const pendientes = metodosPago.filter((metodo) =>
    isPendingTerceroPaymentMethodId(metodo.id),
  );
  const restantes = metodosPago
    .filter((metodo) => !isPendingTerceroPaymentMethodId(metodo.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return [...pendientes, ...restantes];
}
