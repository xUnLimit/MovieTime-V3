# Sistema de Tracking Detallado de Cambios - Log de Actividad

**Fecha:** 2026-02-13
**Objetivo:** Mejorar el Log de Actividad para mostrar cambios específicos (antes/después) en operaciones de actualización/edición.

---

## Problema Actual

El Log de Actividad registra todas las operaciones CRUD del sistema, pero para las actualizaciones solo muestra un mensaje genérico:
```
Servicio actualizado: "Netflix"
```

**No muestra:**
- Qué campos específicos cambiaron
- Valores anteriores vs. nuevos valores
- Contexto útil para auditoría

---

## Solución Propuesta

### Arquitectura de 3 Capas

1. **Datos**: Agregar campo opcional `cambios` al tipo `ActivityLog`
2. **Lógica**: Helpers para detectar y formatear cambios automáticamente
3. **UI**: Modal que muestra comparación visual antes/después

### Características

- ✅ **Backward compatible**: Logs antiguos sin `cambios` siguen funcionando
- ✅ **Automático**: Los helpers comparan objetos y generan cambios
- ✅ **Selectivo**: Solo trackea campos críticos (no basura como `updatedAt`)
- ✅ **Visual**: Modal con colores (rojo=antes, verde=después)
- ✅ **Buscable**: El campo `detalles` mantiene texto resumido

---

## Diseño de Datos

### Nuevos Tipos

```typescript
// src/types/common.ts

export interface CambioLog {
  campo: string;        // "Precio", "Estado", etc.
  campoKey: string;     // "precio", "estado" (key técnico)
  anterior: any;        // Valor anterior
  nuevo: any;          // Valor nuevo
  tipo?: 'string' | 'number' | 'boolean' | 'date' | 'money' | 'object';
}

export interface ActivityLog {
  // ... campos existentes
  detalles: string;      // "Servicio actualizado: Netflix — 3 cambios: precio, perfiles, estado"
  cambios?: CambioLog[]; // Solo presente en accion === 'actualizacion'
  timestamp: Date;
}
```

### Campos Trackeables por Entidad

Solo campos críticos (no todos):

**Servicios:**
- nombre, activo, perfilesDisponibles, perfilesOcupados
- fechaVencimiento, costoServicio, categoriaNombre, metodoPagoNombre

**Ventas:**
- estado, precioFinal, fechaFin, perfilNombre, cicloPago

**Usuarios:**
- nombre, email, telefono, montoSinConsumir, serviciosActivos

**Categorías:**
- nombre, descripcion, tipoCategoria

**Métodos de Pago:**
- nombre, tipo, activo

**Templates:**
- nombre, tipo, contenido, activo

---

## Helpers de Comparación

### `detectarCambios(entidad, anterior, nuevo)`

Compara dos objetos y retorna array de cambios:

```typescript
const cambios = detectarCambios('servicio', servicioAnterior, {
  ...servicioAnterior,
  ...servicioData
});
// => [{ campo: 'Precio', campoKey: 'costoServicio', anterior: 15.99, nuevo: 17.99, tipo: 'money' }]
```

**Características:**
- Solo compara campos en `TRACKEABLE_FIELDS[entidad]`
- Maneja correctamente `null`, `undefined`, `Date`
- Retorna array vacío si no hay cambios

### `generarResumenCambios(cambios)`

Genera texto corto para el campo `detalles`:

```typescript
generarResumenCambios([...])
// => "3 cambios: precio, perfiles, estado"
```

**Formatos:**
- 0 cambios → "sin cambios"
- 1 cambio → "1 cambio: Precio"
- 2-3 cambios → "3 cambios: precio, perfiles, estado"
- 4+ cambios → "5 cambios: precio, perfiles, estado..."

---

## UI: Modal de Cambios

### Componente `CambiosModal`

Modal que muestra la comparación visual:

```tsx
<CambiosModal
  open={cambiosModalOpen}
  onOpenChange={setCambiosModalOpen}
  entidadNombre="Netflix"
  cambios={selectedLog.cambios}
/>
```

**Layout:**
```
┌─────────────────────────────────────┐
│ Cambios en Netflix                  │
├─────────────────────────────────────┤
│ 🔖 Precio                           │
│  Antes          →       Después     │
│ ┌──────────┐         ┌──────────┐  │
│ │ $15.99   │    →    │ $17.99   │  │
│ │ (rojo)   │         │ (verde)  │  │
│ └──────────┘         └──────────┘  │
├─────────────────────────────────────┤
│ 🔖 Perfiles Disponibles             │
│  Antes          →       Después     │
│ ┌──────────┐         ┌──────────┐  │
│ │ 4        │    →    │ 5        │  │
│ └──────────┘         └──────────┘  │
└─────────────────────────────────────┘
```

**Formateo por tipo:**
- `money`: `$15.99`
- `date`: `13/02/2026`
- `boolean`: `Activo` / `Inactivo`
- `string`: texto directo
- `number`: número directo

### Integración en LogTimeline

Modificar la columna "Detalles":

```tsx
<div className="flex items-center justify-center gap-2">
  <span className="text-sm">{item.detalles}</span>
  {item.cambios && item.cambios.length > 0 && (
    <Button variant="ghost" size="sm" onClick={() => handleOpenCambios(item)}>
      <Eye className="h-3 w-3 mr-1" />
      Ver cambios ({item.cambios.length})
    </Button>
  )}
</div>
```

**Comportamiento:**
- Sin cambios → solo texto
- Con cambios → texto + botón "Ver cambios (N)"
- Clic en botón → abre modal

---

## Patrón de Uso en Stores

### Ejemplo: `serviciosStore.updateServicio()`

```typescript
updateServicio: async (id, servicioData) => {
  set({ isLoading: true, error: null });
  try {
    // 1. Obtener servicio ANTES del update
    const servicio = await getById<Servicio>(COLLECTIONS.SERVICIOS, id);
    if (!servicio) throw new Error('Servicio no encontrado');

    // 2. Update en Firebase
    await update(COLLECTIONS.SERVICIOS, id, servicioData);

    // 3. Detectar cambios
    const cambios = detectarCambios('servicio', servicio, {
      ...servicio,
      ...servicioData
    });

    // 4. Generar resumen
    const resumenCambios = generarResumenCambios(cambios);

    // 5. Update local store
    set((state) => ({
      servicios: state.servicios.map((s) =>
        s.id === id ? { ...s, ...servicioData } : s
      ),
      isLoading: false,
    }));

    // 6. Log con cambios
    useActivityLogStore.getState().addLog({
      ...getLogContext(),
      accion: 'actualizacion',
      entidad: 'servicio',
      entidadId: id,
      entidadNombre: servicio.nombre,
      detalles: `Servicio actualizado: "${servicio.nombre}" — ${resumenCambios}`,
      cambios: cambios.length > 0 ? cambios : undefined,
    }).catch(() => {});

  } catch (error) {
    set({ error: error.message, isLoading: false });
  }
}
```

**Aplicar a todos los stores:**
- `serviciosStore.updateServicio()`
- `ventasStore.updateVenta()`
- `usuariosStore.updateUsuario()`
- `categoriasStore.updateCategoria()`
- `metodosPagoStore.updateMetodoPago()`
- `templatesStore.updateTemplate()`

---

## Archivos a Crear/Modificar

| Archivo | Acción |
|---------|--------|
| `src/types/common.ts` | Agregar `CambioLog` + campo `cambios?` a `ActivityLog` |
| `src/lib/utils/activityLogHelpers.ts` | Crear helpers (nuevo archivo) |
| `src/components/log-actividad/CambiosModal.tsx` | Crear modal (nuevo archivo) |
| `src/components/log-actividad/LogTimeline.tsx` | Agregar botón + modal |
| `src/store/serviciosStore.ts` | Integrar `detectarCambios()` en update |
| `src/store/ventasStore.ts` | Integrar `detectarCambios()` en update |
| `src/store/usuariosStore.ts` | Integrar `detectarCambios()` en update |
| `src/store/categoriasStore.ts` | Integrar `detectarCambios()` en update |
| `src/store/metodosPagoStore.ts` | Integrar `detectarCambios()` en update |
| `src/store/templatesStore.ts` | Integrar `detectarCambios()` en update |

---

## Ejemplo de Resultado

**Antes:**
```
Servicio actualizado: "Netflix"
```

**Después (en tabla):**
```
Servicio actualizado: "Netflix" — 3 cambios: precio, perfiles, estado
[Ver cambios (3)]  ← botón
```

**Después (en modal):**
```
╔══════════════════════════════════╗
║ Cambios en Netflix               ║
╠══════════════════════════════════╣
║ 🏷️ Precio                        ║
║  $15.99  →  $17.99               ║
║ 🏷️ Perfiles Disponibles          ║
║  4  →  5                         ║
║ 🏷️ Estado                        ║
║  Activo  →  Inactivo             ║
╚══════════════════════════════════╝
```

---

## Beneficios

1. **Auditoría completa**: Se puede ver exactamente qué cambió y cuándo
2. **Troubleshooting**: Identificar quién hizo qué cambio
3. **Compliance**: Registro detallado para auditorías externas
4. **UX mejorada**: Información clara sin saturar la tabla
5. **Escalable**: Fácil agregar más campos o entidades

---

## Notas de Implementación

- **Fire-and-forget**: Los logs usan `.catch(() => {})` — nunca bloquean la operación principal
- **Performance**: Solo se comparan campos críticos, no todo el objeto
- **Firestore**: El campo `cambios` es un array de objetos — Firebase lo maneja nativamente
- **Timestamps**: Los helpers manejan conversión de Firestore Timestamps automáticamente
- **Backward compatibility**: Logs antiguos sin `cambios` muestran solo el texto de `detalles`
