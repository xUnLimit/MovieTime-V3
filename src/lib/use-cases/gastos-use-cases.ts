import { getGastos, getTiposGasto } from "@/lib/supabase/catalogos-repository";
import type { Gasto, TipoGasto } from "@/types";

function sortGastos(gastos: Gasto[]) {
  return [...gastos].sort((a, b) => {
    const diff = b.fecha.getTime() - a.fecha.getTime();
    if (diff !== 0) return diff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

function sortTiposGasto(tiposGasto: TipoGasto[]) {
  return [...tiposGasto].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
  );
}

export async function fetchGastosUseCase<T = Gasto>() {
  const gastos = await getGastos<Gasto>();
  return sortGastos(gastos) as T[];
}

export async function fetchTiposGastoUseCase<T = TipoGasto>() {
  const tiposGasto = await getTiposGasto<TipoGasto>();
  return sortTiposGasto(tiposGasto) as T[];
}
