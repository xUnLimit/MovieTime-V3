import { normalizePhoneSearch, normalizeSearchText } from "@/lib/utils";
import { isPendingUserPaymentMethodId } from "@/lib/utils/usuarioMetodoPago";
import type { Usuario } from "@/types";

export type UsuariosTab = "todos" | "clientes" | "revendedores";

interface FilterUsuariosOptions {
  usuarios: Usuario[];
  searchQuery: string;
  activeTab: UsuariosTab;
  selectedMetodoPagoFilter: string;
  allPaymentMethodsValue: string;
}

export function filterUsuariosForUsuariosPage({
  usuarios,
  searchQuery,
  activeTab,
  selectedMetodoPagoFilter,
  allPaymentMethodsValue,
}: FilterUsuariosOptions): Usuario[] {
  const search = normalizeSearchText(searchQuery);
  const phoneQuery = normalizePhoneSearch(searchQuery);

  return [...usuarios]
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

function matchesTab(usuario: Usuario, activeTab: UsuariosTab): boolean {
  if (activeTab === "clientes") return usuario.tipo === "cliente";
  if (activeTab === "revendedores") return usuario.tipo === "revendedor";
  return true;
}

function matchesMetodoPago(
  usuario: Usuario,
  selectedMetodoPagoFilter: string,
  allPaymentMethodsValue: string,
): boolean {
  if (selectedMetodoPagoFilter === allPaymentMethodsValue) return true;
  if (isPendingUserPaymentMethodId(selectedMetodoPagoFilter)) {
    return (
      !usuario.metodoPagoId ||
      isPendingUserPaymentMethodId(usuario.metodoPagoId)
    );
  }

  return usuario.metodoPagoId === selectedMetodoPagoFilter;
}
