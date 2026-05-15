import { normalizePhoneSearch, normalizeSearchText } from "@/lib/utils";
import { isPendingTerceroPaymentMethodId } from "@/lib/utils/terceroMetodoPago";
import type { Tercero } from "@/types";

export type TercerosTab = "todos" | "clientes" | "revendedores";

interface FilterTercerosOptions {
  terceros: Tercero[];
  searchQuery: string;
  activeTab: TercerosTab;
  selectedMetodoPagoFilter: string;
  allPaymentMethodsValue: string;
}

export function filterTercerosForTercerosPage({
  terceros,
  searchQuery,
  activeTab,
  selectedMetodoPagoFilter,
  allPaymentMethodsValue,
}: FilterTercerosOptions): Tercero[] {
  const search = normalizeSearchText(searchQuery);
  const phoneQuery = normalizePhoneSearch(searchQuery);

  return [...terceros]
    .sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    })
    .filter((usuario) => {
      if (!matchesTab(usuario, activeTab)) return false;
      if (
        !matchesMetodoPago(
          usuario,
          selectedMetodoPagoFilter,
          allPaymentMethodsValue,
        )
      ) {
        return false;
      }

      if (!search) return true;

      const nombreCompleto = normalizeSearchText(
        `${usuario.nombre} ${usuario.apellido || ""}`,
      );
      const telefono = normalizePhoneSearch(usuario.telefono);

      return (
        nombreCompleto.includes(search) ||
        (phoneQuery.length > 0 && telefono.includes(phoneQuery))
      );
    });
}

function matchesTab(usuario: Tercero, activeTab: TercerosTab): boolean {
  if (activeTab === "clientes") return usuario.tipo === "cliente";
  if (activeTab === "revendedores") return usuario.tipo === "revendedor";
  return true;
}

function matchesMetodoPago(
  usuario: Tercero,
  selectedMetodoPagoFilter: string,
  allPaymentMethodsValue: string,
): boolean {
  if (selectedMetodoPagoFilter === allPaymentMethodsValue) return true;
  if (isPendingTerceroPaymentMethodId(selectedMetodoPagoFilter)) {
    return (
      !usuario.metodoPagoId ||
      isPendingTerceroPaymentMethodId(usuario.metodoPagoId)
    );
  }

  return usuario.metodoPagoId === selectedMetodoPagoFilter;
}
