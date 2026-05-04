# Paginación Server-Side + Cache de Lecturas Secundarias

Patrón implementado primero en el módulo **Usuarios** (Feb 2026).
Este documento describe la arquitectura completa para que se pueda replicar
en cualquier otro módulo que tenga una tabla paginada con datos relacionados.

---

## Problema que resuelve

Una tabla con N registros necesita datos relacionados por fila (ej: monto de ventas por usuario).
Sin optimización esto cuesta:

| Enfoque naïf | Lecturas por visita |
|---|---|
| `getAll` de la colección principal | N docs (toda la colección) |
| Query por cada fila para datos relacionados | N queries adicionales |

Con el patrón implementado:

| Enfoque optimizado | Lecturas por visita |
|---|---|
| Paginación con cursores (`pageSize + 1`) | `pageSize + 1` docs |
| Conteos para métricas (no son lecturas de docs) | 0 doc-reads |
| Una sola query `in [ids]` para datos relacionados | ≤ pageSize docs |
| Cache 5 min en memoria | 0 en visitas repetidas |

**Ejemplo real (Usuarios, pageSize=10):** 11 (paginados) + 5 (ventas query) = **16 lecturas totales** por visita.

---

## Arquitectura: 4 piezas

```
page.tsx                          ← orquestador
  ├── useServerPagination()       ← paginación con cursores (Hook)
  ├── <TablesComponent>
  │     ├── useVentasPorUsuarios() ← query secundaria con cache (Hook)
  │     └── <PaginationFooter>    ← UI de navigación
  └── store.fetchCounts()         ← conteos para métricas (Zustand)
```

---

## 1. Paginación con cursores — `useServerPagination`

**Archivo:** `src/hooks/useServerPagination.ts`

### Cómo funciona

- Usa `getPaginated()` de `src/lib/firebase/pagination.ts`
- Trae exactamente `pageSize + 1` docs: los N que se muestran + 1 para saber si hay más (`hasMore`)
- Guarda los cursores (last document snapshot) en un `useRef` para navegar sin re-queriar páginas anteriores
- Se resetea automáticamente cuando cambian los `filters` (ej: cambio de tab)

### Uso básico

```typescript
import { useServerPagination } from '@/hooks/useServerPagination';
import { COLLECTIONS } from '@/lib/firebase/firestore';
import { FilterOption } from '@/lib/firebase/pagination';

const PAGE_SIZE = 10;

// Filtros dinámicos (ej: según tab activo)
const filters: FilterOption[] = useMemo(() => {
  if (activeTab === 'activas') return [{ field: 'estado', operator: '==', value: 'activo' }];
  return [];
}, [activeTab]);

const {
  data,        // T[] — docs de la página actual
  isLoading,   // boolean — true mientras Firestore responde
  hasMore,     // boolean — hay página siguiente
  hasPrevious, // boolean — hay página anterior
  page,        // number — página actual (1-indexed)
  next,        // () => void
  previous,    // () => void
  refresh,     // () => void — fuerza re-fetch de la página actual
} = useServerPagination<MiTipo>({
  collectionName: COLLECTIONS.MI_COLECCION,
  filters,
  pageSize: PAGE_SIZE,
  // orderByField?: string   (default: 'createdAt')
  // orderDirection?: 'asc' | 'desc'  (default: 'desc')
});
```

### Calcular totalPages

`hasMore` solo dice "hay más", no cuántas. Para mostrar "Página X de Y" necesitas el total:

```typescript
// El total viene de un count (no de lecturas de docs)
const total = activeTab === 'activas' ? totalActivas : totalTodos;
const totalPages = Math.ceil(total / PAGE_SIZE);
```

Los conteos se obtienen con `getCount()` en el store (ver sección 4).

### Props para la tabla

```typescript
const paginationProps = {
  page,
  totalPages,
  hasPrevious,
  hasMore,
  onPrevious: previous,
  onNext: next,
};

<MiTabla
  data={data}
  isLoading={isLoading}
  pagination={paginationProps}
  onRefresh={refresh}
/>
```

---

## 2. Cache de query secundaria — patrón `useXxxPorUsuarios`

**Ejemplo real:** `src/hooks/use-ventas-por-usuarios.ts`

Este hook resuelve un problema específico: cada fila de la tabla necesita un dato que no está
en el documento principal (ej: "monto sin consumir" calculado a partir de las ventas).

### El problema sin cache

Cuando Next.js monta/desmonta tabs, los componentes se recrean.
Un `useRef` interno se destruye en cada remontaje → el cache se pierde → query repetida.

### La solución: cache a nivel de módulo

```typescript
// FUERA del hook — persiste mientras el módulo esté cargado en memoria
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const miCache = new Map<string, { data: Record<string, MisStats>; ts: number }>();
```

`Map` a nivel de módulo sobrevive remontajes de componentes.
Solo se limpia cuando el módulo se descarga del bundle (raramente sucede en SPA).

### El problema de IDs stale al cambiar tabs

Cuando cambia de tab, `useServerPagination` pone `isLoading=true` mientras trae los nuevos docs.
Durante ese instante, `data` aún contiene los docs del tab anterior → los IDs son incorrectos.
Si el hook de la query secundaria dispara en ese momento, hace una query innecesaria con IDs equivocados.

**Solución:** parámetro `enabled`

```typescript
const { stats } = useVentasPorUsuarios(ids, { enabled: !isLoading });
//                                           ^^^^^^^^^^^^^^^^^^^^^^
// El hook no dispara hasta que isLoading=false (datos estables)
```

### Template completo para replicar

```typescript
'use client';
import { useEffect, useState } from 'react';
import { COLLECTIONS, queryDocuments } from '@/lib/firebase/firestore';

export interface MisStats {
  // campos calculados que necesitas por row
  valorCalculado: number;
}

// ── Cache a nivel de módulo ──────────────────────────────
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, { data: Record<string, MisStats>; ts: number }>();

/**
 * @param ids     – IDs de los items de la página actual (máx 10 por limitación de `in`)
 * @param enabled – false mientras la paginación está cargando (evita IDs stale)
 */
export function useMisStatsPorItem(ids: string[], { enabled = true } = {}) {
  const [stats, setStats] = useState<Record<string, MisStats>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Key estable: evita re-render por nueva referencia de array
  const idsKey = ids.join(',');

  useEffect(() => {
    if (!enabled) return;                          // ① esperar datos estables
    if (ids.length === 0) { setStats({}); return; } // ② sin IDs, sin query

    // ③ Cache hit
    const cached = cache.get(idsKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      if (process.env.NODE_ENV === 'development') {
        console.log(
          '%c[MisStats Cache]%c HIT · ' + ids.length + ' IDs · age ' +
            Math.round((Date.now() - cached.ts) / 1000) + 's',
          'background:#4CAF50;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600',
          'color:#4CAF50;font-weight:600'
        );
      }
      setStats(cached.data);
      return;
    }

    // ④ Query + cálculo
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const docs = await queryDocuments<Record<string, unknown>>(COLLECTIONS.MI_COLECCION, [
          { field: 'referenciaId', operator: 'in', value: ids },
        ]);

        if (cancelled) return;

        const result: Record<string, MisStats> = {};

        docs.forEach((doc) => {
          const refId = doc.referenciaId as string | undefined;
          if (!refId) return;

          // Tu lógica de cálculo aquí
          if (!result[refId]) result[refId] = { valorCalculado: 0 };
          result[refId].valorCalculado += /* tu cálculo */;
        });

        cache.set(idsKey, { data: result, ts: Date.now() });
        setStats(result);
      } catch (error) {
        console.error('Error cargando stats:', error);
        if (!cancelled) setStats({});
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, enabled]);

  return { stats, isLoading };
}
```

### Uso en la tabla

```typescript
// Dentro del componente de tabla:
const itemIds = useMemo(() => items.map(i => i.id), [items]);
const { stats } = useMisStatsPorItem(itemIds, { enabled: !isLoading });

// En el render de la columna:
render: (item) => {
  const valor = stats[item.id]?.valorCalculado ?? 0;
  return <span>{valor.toFixed(2)}</span>;
}
```

### Restricción de Firestore: `in` acepta máximo 10 valores

`pageSize` debe ser ≤ 10 si vas a usar esta query.
Si necesitas más de 10 por página, hay que partir en múltiples queries o usar otro enfoque.

---

## 3. UI de paginación — `PaginationFooter`

**Archivo:** `src/components/shared/PaginationFooter.tsx`

Componente reutilizable. Si `totalPages <= 1` no se renderiza nada.

```typescript
import { PaginationFooter, PaginationFooterProps } from '@/components/shared/PaginationFooter';

// Props que necesita:
interface PaginationFooterProps {
  page: number;          // página actual (1-indexed)
  totalPages: number;    // total de páginas
  hasPrevious: boolean;  // deshabilita "Anterior"
  hasMore: boolean;      // deshabilita "Siguiente"
  onPrevious: () => void;
  onNext: () => void;
}

// Uso dentro de la tabla (al final, fuera del DataTable):
<PaginationFooter {...pagination} />
```

---

## 4. Conteos sin lecturas de docs — `getCount` + `fetchCounts`

Los conteos para las métricas (ej: "Total Clientes", "Total Revendedores") no deben traer docs.
`getCount()` usa la operación `count()` de Firestore que **no cobra lecturas de documentos** en el plan Spark.

### En el store

```typescript
import { getCount, COLLECTIONS } from '@/lib/firebase/firestore';

// En el store (ej: usuariosStore):
fetchCounts: async () => {
  const [totalA, totalB, totalC] = await Promise.all([
    getCount(COLLECTIONS.MI_COLECCION, [{ field: 'estado', operator: '==', value: 'activo' }]),
    getCount(COLLECTIONS.MI_COLECCION, [{ field: 'estado', operator: '==', value: 'inactivo' }]),
    getCount(COLLECTIONS.MI_COLECCION, [{ field: 'createdAt', operator: '>=', value: startOfDay(new Date()) }]),
  ]);
  set({ totalA, totalB, totalC });
}
```

### En la página

```typescript
const { totalA, totalB, fetchCounts } = useMyStore();

useEffect(() => {
  fetchCounts();
}, [fetchCounts]);
```

### Firma de `getCount`

```typescript
getCount(
  collectionName: string,
  filters?: { field: string; operator: WhereFilterOp; value: unknown }[]
): Promise<number>
```

---

## 5. Denormalización de campos frecuentes — `adjustVentasActivas`

Si una columna de la tabla se consulta en cada visita y cambia raramente,
se puede denormalizar en el documento del usuario para evitar queries.

**Ejemplo:** `ventasActivas` se guarda en el doc del usuario.
Se incrementa/decrementa atómicamente cada vez que se crea/elimina una venta.

```typescript
// En firestore.ts:
adjustVentasActivas(clienteId: string, delta: number): Promise<void>
// delta: +1 al crear venta activa, -1 al eliminar/inactivar
```

Esto se llama desde:
- La creación de ventas (delta = +1)
- La eliminación de ventas (delta = -1) — ver `use-ventas-usuario.ts`

El campo `ventasActivas` se lee directamente del doc paginado, sin query adicional.

---

## Resumen: checklist para replicar en otro módulo

1. **Crear la función de paginación en Firestore** — ya existe en `pagination.ts`, solo usar `getPaginated`
2. **Crear el hook de paginación** — copiar patrón de `useServerPagination.ts`, ajustar tipos
3. **Agregar `fetchCounts` al store** — usar `getCount` con los filtros que necesites
4. **Crear `PaginationFooter`** — ya existe en `shared/`, reusar directamente
5. **Si necesitas datos relacionados por fila:**
   - Crear hook con cache a nivel de módulo (patrón de sección 2)
   - Usar `enabled: !isLoading` para evitar IDs stale
   - Pasar IDs desde `useMemo` en la tabla
6. **Si un campo relacionado se lee mucho y cambia poco:**
   - Denormalizar en el doc principal
   - Usar operación atómica (`increment`) para mantener consistencia
7. **Pasar `isLoading` + `onRefresh` a la tabla** para que pueda mostrar loading state y refrescar tras CRUD

---

## Archivos de referencia (implementación real en Usuarios)

| Archivo | Rol |
|---|---|
| `src/hooks/useServerPagination.ts` | Hook de paginación con cursores |
| `src/lib/firebase/pagination.ts` | `getPaginated()` — query de Firestore con cursor |
| `src/hooks/use-ventas-por-usuarios.ts` | Hook de query secundaria con cache |
| `src/components/shared/PaginationFooter.tsx` | UI de paginación |
| `src/store/usuariosStore.ts` | `fetchCounts()` con `getCount` |
| `src/app/(dashboard)/usuarios/page.tsx` | Orquestador: filtros → paginación → tabs |
| `src/components/usuarios/ClientesTable.tsx` | Ejemplo de tabla con hook secundario |
| `src/components/usuarios/TodosUsuariosTable.tsx` | Ejemplo con mix de tipos (cliente/revendedor) |
| `src/components/usuarios/RevendedoresTable.tsx` | Ejemplo preparado para datos futuros |
