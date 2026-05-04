# Sistema de Notificaciones Persistentes - Diseño Refinado v2.1

**Fecha:** 2026-02-12
**Versión:** 2.1 (Refinado)
**Estado:** Aprobado - Listo para Implementación

---

## 📋 Resumen Ejecutivo

Implementación de un sistema de notificaciones persistentes para ventas y servicios próximos a vencer, con:
- Bell icon en header con badge dinámico (🟠 naranja / 🔴 rojo / 🟡 amarillo)
- Dropdown con resumen de notificaciones
- **Sincronización automática DIARIA** (una vez al día, no polling)
- **Auto-actualización DIARIA** con días restantes exactos
- **Sistema de resaltado manual** para seguimiento prioritario
- **Toggle leída/no leída inteligente** (solo resetea si prioridad aumenta)
- **Íconos interactivos** (🔔/🔕/⚠️) con click para toggle
- **Modal de acciones dual** (opciones vs confirmación directa)
- Auto-eliminación al renovar venta/servicio o cortar por falta de pago

---

## 🎯 Objetivos

### Funcionales
1. Mostrar notificaciones de ventas/servicios próximos a vencer en el header
2. Badge con color dinámico según prioridad más alta (naranja > rojo > amarillo)
3. Dropdown con resumen y acceso rápido a `/notificaciones`
4. Notificaciones persisten en Firebase (colección `notificaciones`)
5. Auto-actualización de prioridad conforme se acerca el vencimiento
6. Sistema de resaltado manual para marcar notificaciones críticas
7. Usuario puede marcar como leída/no leída (click en ícono)
8. Notificaciones se eliminan al renovar o cortar
9. Sincronización inteligente: una vez al día (no polling constante)

### No Funcionales
1. Sincronización en <2 segundos al cargar dashboard
2. Máximo 1 notificación por venta/servicio (auto-actualización)
3. Una sincronización por día (verificación con localStorage)
4. Compatible con sistema de caché (5 min TTL)
5. ~20 lecturas/día vs 1,920 lecturas/día (96% reducción vs polling)

---

## 🏗️ Arquitectura del Sistema

### Componentes Nuevos

```
src/
├── components/
│   ├── layout/
│   │   └── NotificationBell.tsx                    # Bell icon con dropdown y jerarquía de colores
│   └── notificaciones/
│       ├── AccionesVentaDialog.tsx                 # Modal con dos flujos (opciones vs confirmación)
│       ├── VentasProximasTableV2.tsx               # Nueva versión con íconos interactivos
│       └── ServiciosProximosTableV2.tsx            # Nueva versión con íconos interactivos
├── lib/
│   └── services/
│       └── notificationSyncService.ts              # Lógica de sincronización diaria
└── app/(dashboard)/
    └── notificaciones-test/                        # 🆕 Ruta paralela para testing
        └── page.tsx
```

### Componentes Modificados

```
src/
├── app/
│   └── (dashboard)/
│       ├── layout.tsx                              # Agregar sincronización diaria
│       └── notificaciones/
│           └── page.tsx                            # ✅ MANTENER sin cambios (versión actual)
├── components/
│   └── layout/
│       ├── Header.tsx                              # Incluir NotificationBell
│       └── Sidebar.tsx                             # Agregar entrada temporal "Notificaciones Test"
├── store/
│   └── notificacionesStore.ts                     # Nuevas acciones: toggleLeida, toggleResaltada, deleteByEntity
└── types/
    └── notificaciones.ts                          # Agregar campo resaltada: boolean
```

---

## 📊 Modelo de Datos

### Estructura de Notificación (Firebase)

```typescript
interface Notificacion {
  id: string;
  tipo: 'sistema';
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  titulo: string;          // "Venta vence en 15 días" | "Servicio vence en 2 días" | "Venta vencida (2 días)"
  mensaje: string;         // "Juan Pérez - Netflix"
  leida: boolean;          // Toggle por click en ícono
  resaltada: boolean;      // ✅ NUEVO: Marcada manualmente para seguimiento prioritario

  // Referencias (mutuamente exclusivas)
  ventaId?: string;        // Si es notificación de venta
  servicioId?: string;     // Si es notificación de servicio

  // Metadata
  diasRestantes: number;   // Número exacto de días restantes (puede ser negativo)
  fechaEvento: Date;       // Fecha de vencimiento de la venta/servicio

  // Audit
  createdAt: Date;
  updatedAt?: Date;        // Se actualiza CADA DÍA durante la sincronización
}
```

### Cambios vs Plan Original v2.0

**Campos eliminados:**
- ❌ `estado: '7_dias' | '3_dias' | '1_dia' | 'vencido'` - Ya no existe
- ❌ `accionSugerida: 'renovar' | 'cortar'` - Se calcula en UI según `diasRestantes < 0`

**Campos nuevos:**
- ✅ `resaltada: boolean` - Admin marca para seguimiento prioritario

**Comportamiento "leída" refinado:**
- Solo resetea a `leida: false` si la prioridad aumenta (media→alta, alta→crítica)
- Si solo cambian `diasRestantes` (ej. 15→14), mantiene estado `leida` actual

### Mapeo de Prioridad (Continuo)

| Días Restantes | Prioridad | Color Badge Normal | Color Resaltada |
|----------------|-----------|-------------------|-----------------|
| >= 7           | baja      | 🟢 Verde/Azul     | 🟠 Naranja      |
| 4-6            | media     | 🟡 Amarillo       | 🟠 Naranja      |
| 2-3            | alta      | 🟠 Naranja        | 🟠 Naranja      |
| 0-1            | critica   | 🔴 Rojo           | 🟠 Naranja      |
| < 0            | critica   | 🔴 Rojo           | 🟠 Naranja      |

**Lógica de Prioridad:**
```typescript
function calcularPrioridad(diasRestantes: number): PrioridadNotificacion {
  if (diasRestantes <= 1) return 'critica';  // 0, 1, o negativo
  if (diasRestantes <= 3) return 'alta';      // 2, 3
  if (diasRestantes <= 6) return 'media';     // 4, 5, 6
  return 'baja';                              // 7+
}
```

---

## 🎨 Sistema de Íconos y Estados Visuales

### Íconos de la Columna "Tipo"

| Estado | Ícono | Color | Cuenta en Badge | Interacción |
|--------|-------|-------|----------------|-------------|
| Normal + No leída | 🔔 | Según prioridad* | ✅ Sí | Click → 🔕 |
| Normal + Leída | 🔕 | Gris apagado | ❌ No | Click → 🔔 |
| Resaltada + No leída | ⚠️ | Naranja | ✅ Sí (siempre) | Click → ⚠️ (mantiene) |
| Resaltada + Leída | ⚠️ | Naranja | ✅ Sí (siempre) | Click → ⚠️ (mantiene) |

*Colores según prioridad normal:
- Crítica: 🔴 Rojo
- Alta: 🟠 Naranja
- Media: 🟡 Amarillo
- Baja: 🟢 Verde/Azul

**Nota crítica:** Las notificaciones resaltadas (⚠️) **siempre** cuentan en el badge del header, incluso si están marcadas como "leídas" internamente. Esto asegura que nunca se olviden hasta que se tome acción definitiva (cortar/renovar).

### Columna "Estado" - Badge

**Cuando NO está resaltada:**
- `[X días restantes]` - Color según prioridad
- `[Vence hoy]` - Rojo
- `[X días vencida]` - Rojo

**Cuando SÍ está resaltada:**
- `[⚠️ X días restantes]` - Naranja
- `[⚠️ Vence hoy]` - Naranja
- `[⚠️ X días vencida]` - Naranja

### Jerarquía de Colores del Badge (Header)

1. 🟠 **Naranja:** Hay notificaciones resaltadas (prioridad máxima visual)
2. 🔴 **Rojo:** Hay críticas sin resaltar
3. 🟡 **Amarillo:** Solo media/alta sin resaltar
4. ⚫ **Sin badge:** Sin notificaciones no leídas

**Contador del badge:**
- Notificaciones normales no leídas (🔔): cuentan
- Notificaciones normales leídas (🔕): no cuentan
- Notificaciones resaltadas (⚠️): **siempre cuentan** (leídas o no)

---

## 🔄 Flujo de Sincronización Diaria

### Sincronización Optimizada: Una Vez al Día

```typescript
// src/lib/services/notificationSyncService.ts

export async function sincronizarNotificaciones(): Promise<void> {
  // 1. Verificar si ya sincronizó hoy
  const lastSync = localStorage.getItem('lastNotificationSync');
  const today = new Date().toDateString();

  if (lastSync === today) {
    console.log('[NotificationSync] Ya sincronizado hoy. Skip.');
    return;
  }

  console.log('[NotificationSync] Sincronizando notificaciones del día...');

  // 2. Query ventas próximas (7 días de ventana)
  const fechaLimite = addDays(new Date(), 7);

  const ventasProximas = await queryDocuments<VentaDoc>(
    COLLECTIONS.VENTAS,
    [
      { field: 'estado', operator: '==', value: 'activo' },
      { field: 'fechaFin', operator: '<=', value: fechaLimite }
    ]
  );

  // 3. Query ventas vencidas (fechaFin < hoy)
  const ventasVencidas = await queryDocuments<VentaDoc>(
    COLLECTIONS.VENTAS,
    [
      { field: 'estado', operator: '==', value: 'activo' },
      { field: 'fechaFin', operator: '<', value: new Date() }
    ]
  );

  const todasLasVentas = [...ventasProximas, ...ventasVencidas];

  // 4. Procesar cada venta
  for (const venta of todasLasVentas) {
    await procesarVenta(venta);
  }

  // 5. Mismo proceso para servicios
  const serviciosProximos = await queryDocuments<Servicio>(
    COLLECTIONS.SERVICIOS,
    [
      { field: 'activo', operator: '==', value: true },
      { field: 'fechaVencimiento', operator: '<=', value: fechaLimite }
    ]
  );

  const serviciosVencidos = await queryDocuments<Servicio>(
    COLLECTIONS.SERVICIOS,
    [
      { field: 'activo', operator: '==', value: true },
      { field: 'fechaVencimiento', operator: '<', value: new Date() }
    ]
  );

  const todosLosServicios = [...serviciosProximos, ...serviciosVencidos];

  for (const servicio of todosLosServicios) {
    await procesarServicio(servicio);
  }

  // 6. Guardar timestamp de hoy
  localStorage.setItem('lastNotificationSync', today);

  console.log('[NotificationSync] Sincronización completada');
}
```

### Lógica de Procesamiento por Venta

```typescript
async function procesarVenta(venta: VentaDoc): Promise<void> {
  const diasRestantes = differenceInDays(new Date(venta.fechaFin), new Date());
  const nuevaPrioridad = calcularPrioridad(diasRestantes);

  // Buscar notificación existente
  const notifExistente = await queryDocuments<Notificacion>(
    COLLECTIONS.NOTIFICACIONES,
    [{ field: 'ventaId', operator: '==', value: venta.id }]
  );

  if (notifExistente.length > 0) {
    const notif = notifExistente[0];

    // Solo actualizar si diasRestantes cambió
    if (notif.diasRestantes !== diasRestantes) {
      const prioridadAnterior = notif.prioridad;
      const prioridadAumento = prioridadSubio(prioridadAnterior, nuevaPrioridad);

      await update(COLLECTIONS.NOTIFICACIONES, notif.id, {
        diasRestantes,
        prioridad: nuevaPrioridad,
        titulo: generarTitulo(diasRestantes, 'venta'),
        // ✅ CRÍTICO: Solo resetear leida si prioridad aumentó
        leida: prioridadAumento ? false : notif.leida,
        // ✅ Mantener resaltada sin cambios
        resaltada: notif.resaltada,
        updatedAt: new Date()
      });

      console.log(`[NotificationSync] Actualizada: ${venta.id} -> ${diasRestantes} días`);
    }
  } else {
    // Crear nueva notificación
    await create(COLLECTIONS.NOTIFICACIONES, {
      tipo: 'sistema',
      prioridad: nuevaPrioridad,
      titulo: generarTitulo(diasRestantes, 'venta'),
      mensaje: `${venta.clienteNombre} - ${venta.servicioNombre}`,
      ventaId: venta.id,
      diasRestantes,
      fechaEvento: venta.fechaFin,
      leida: false,
      resaltada: false  // Inicializar en false
    });

    console.log(`[NotificationSync] Creada: ${venta.id} -> ${diasRestantes} días`);
  }
}

async function procesarServicio(servicio: Servicio): Promise<void> {
  // Lógica idéntica a procesarVenta pero con servicioId
  // ...
}
```

### Funciones Helper

```typescript
function prioridadSubio(
  anterior: PrioridadNotificacion,
  nueva: PrioridadNotificacion
): boolean {
  const niveles = { baja: 1, media: 2, alta: 3, critica: 4 };
  return niveles[nueva] > niveles[anterior];
}

function generarTitulo(diasRestantes: number, tipo: 'venta' | 'servicio'): string {
  const entidad = tipo === 'venta' ? 'Venta' : 'Servicio';

  if (diasRestantes < 0) {
    const diasVencida = Math.abs(diasRestantes);
    return `${entidad} vencida (${diasVencida} día${diasVencida > 1 ? 's' : ''})`;
  }
  if (diasRestantes === 0) return `${entidad} vence hoy`;
  if (diasRestantes === 1) return `${entidad} vence mañana`;
  return `${entidad} vence en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''}`;
}

function calcularPrioridad(diasRestantes: number): PrioridadNotificacion {
  if (diasRestantes <= 1) return 'critica';
  if (diasRestantes <= 3) return 'alta';
  if (diasRestantes <= 6) return 'media';
  return 'baja';
}
```

---

## 🔔 Componente: NotificationBell

### Responsabilidades
- Mostrar bell icon con badge dinámico
- Color según jerarquía: 🟠 naranja > 🔴 rojo > 🟡 amarillo
- Dropdown con resumen de notificaciones
- Botón "Ver todas las notificaciones"
- Estado vacío: "Todo al día"

### Lógica de Contador y Color

```typescript
// src/components/layout/NotificationBell.tsx

const notificacionesNoLeidas = notificaciones.filter(n => !n.leida);
const notificacionesResaltadas = notificaciones.filter(n => n.resaltada);

// ✅ Contador: No leídas normales + TODAS las resaltadas
const unreadCount = notificacionesNoLeidas.filter(n => !n.resaltada).length
                    + notificacionesResaltadas.length;

// ✅ Color: Jerarquía naranja > rojo > amarillo
const hayResaltadas = notificacionesResaltadas.length > 0;
const hayCriticas = notificacionesNoLeidas.some(n => n.prioridad === 'critica' && !n.resaltada);

const badgeColor = hayResaltadas ? 'bg-orange-500'     // 🟠 Prioridad máxima
                 : hayCriticas ? 'bg-red-500'          // 🔴 Críticas
                 : 'bg-yellow-500';                     // 🟡 Media/Alta
```

---

## 🗄️ Store: notificacionesStore (Extendido)

### Nuevas Acciones

```typescript
interface NotificacionesState {
  // ... campos existentes ...

  // ✅ NUEVAS acciones
  toggleLeida: (id: string) => Promise<void>;
  toggleResaltada: (id: string) => Promise<void>;
  deleteNotificacionesPorEntidad: (ventaId?: string, servicioId?: string) => Promise<void>;
}

// Implementación de toggleLeida
toggleLeida: async (id: string) => {
  const notificacion = get().notificaciones.find(n => n.id === id);
  if (!notificacion) return;

  const nuevoEstado = !notificacion.leida;
  await update(COLLECTIONS.NOTIFICACIONES, id, { leida: nuevoEstado });

  set(state => ({
    notificaciones: state.notificaciones.map(n =>
      n.id === id ? { ...n, leida: nuevoEstado } : n
    )
  }));
},

// Implementación de toggleResaltada
toggleResaltada: async (id: string) => {
  const notificacion = get().notificaciones.find(n => n.id === id);
  if (!notificacion) return;

  const nuevoEstado = !notificacion.resaltada;
  await update(COLLECTIONS.NOTIFICACIONES, id, { resaltada: nuevoEstado });

  set(state => ({
    notificaciones: state.notificaciones.map(n =>
      n.id === id ? { ...n, resaltada: nuevoEstado } : n
    )
  }));
},

// Eliminar notificaciones de una entidad
deleteNotificacionesPorEntidad: async (ventaId?: string, servicioId?: string) => {
  const filters = [];
  if (ventaId) filters.push({ field: 'ventaId', operator: '==', value: ventaId });
  if (servicioId) filters.push({ field: 'servicioId', operator: '==', value: servicioId });

  const notificaciones = await queryDocuments<Notificacion>(
    COLLECTIONS.NOTIFICACIONES,
    filters
  );

  const batch = writeBatch(db);
  notificaciones.forEach(n => {
    batch.delete(firestoreDoc(db, COLLECTIONS.NOTIFICACIONES, n.id));
  });
  await batch.commit();

  set(state => ({
    notificaciones: state.notificaciones.filter(
      n => n.ventaId !== ventaId && n.servicioId !== servicioId
    )
  }));
}
```

---

## 💬 Modal de Acciones: Flujos Dual

### Flujo 1: Venta NO Resaltada

Modal muestra **ambas opciones** (cortar o resaltar):

```
┌─────────────────────────────────────────┐
│ Acciones - Venta                         │
├─────────────────────────────────────────┤
│ Cliente: Allan Ordoñez                   │
│ Servicio: Crunchyroll                    │
│ Estado: 2 días restantes                 │
├─────────────────────────────────────────┤
│ ¿Qué acción deseas realizar?             │
│                                          │
│ ○ Cortar servicio ahora                  │
│   └─ Inactivar + liberar perfil +       │
│      eliminar notificación              │
│                                          │
│ ○ Resaltar para seguimiento             │
│   └─ Marca en naranja (campana 🟠)      │
│                                          │
│         [Cancelar]  [Confirmar]         │
└─────────────────────────────────────────┘
```

### Flujo 2: Venta YA Resaltada

Modal de **confirmación directa** para cortar:

```
┌─────────────────────────────────────────┐
│ Cortar Servicio                          │
├─────────────────────────────────────────┤
│ Cliente: Allan Ordoñez                   │
│ Servicio: Crunchyroll                    │
│ Estado: ⚠️ 2 días vencida                │
├─────────────────────────────────────────┤
│ ⚠️ Esto hará:                            │
│ • Estado → Inactivo                      │
│ • Liberar perfil del servicio           │
│ • Eliminar notificación                 │
│                                          │
│ ¿Confirmar corte del servicio?          │
│                                          │
│         [Cancelar]  [Cortar]            │
└─────────────────────────────────────────┘
```

### Lógica de Acciones

**Handler: Cortar Venta**
```typescript
const handleCortar = async () => {
  // 1. Cambiar estado a inactivo
  await updateVenta(selectedVenta.id, { estado: 'inactivo' });

  // 2. Liberar perfil del servicio
  if (selectedVenta.servicioId) {
    await updatePerfilOcupado(selectedVenta.servicioId, false);
  }

  // 3. Decrementar contador del cliente
  if (selectedVenta.clienteId) {
    await adjustServiciosActivos(selectedVenta.clienteId, -1);
  }

  // 4. Eliminar notificaciones
  await deleteNotificacionesPorEntidad(selectedVenta.id, undefined);

  toast.success('Venta cortada exitosamente');
};
```

**Handler: Resaltar Venta**
```typescript
const handleResaltar = async () => {
  const notif = getNotificacion(selectedVenta.id);
  if (notif) {
    await toggleResaltada(notif.id);
    toast.success('Venta resaltada para seguimiento');
  }
};
```

---

## 🔄 Integración con Renovación

### Auto-eliminación al Renovar Venta

```typescript
// En VentasProximasTableV2.tsx

const handleConfirmRenovar = async (formData: Record<string, unknown>) => {
  if (!selectedVenta) return;

  try {
    // Lógica de renovación existente
    await updateVenta(selectedVenta.id, {
      fechaInicio: formData.fechaInicio as Date,
      fechaFin: formData.fechaVencimiento as Date,
      // ...
    });

    // ✅ Eliminar notificaciones de esta venta
    const { deleteNotificacionesPorEntidad } = useNotificacionesStore.getState();
    await deleteNotificacionesPorEntidad(selectedVenta.id, undefined);

    toast.success('Venta renovada exitosamente');
  } catch (error) {
    console.error('Error renovando venta:', error);
    toast.error('Error al renovar la venta');
  }
};
```

### Auto-eliminación al Renovar Servicio

```typescript
// En ServiciosProximosTableV2.tsx

const handleConfirmRenovar = async (formData: Record<string, unknown>) => {
  if (!selectedServicio) return;

  try {
    await updateServicio(selectedServicio.id, {
      fechaVencimiento: formData.fechaVencimiento as Date,
      // ...
    });

    // ✅ Eliminar notificaciones del servicio
    const { deleteNotificacionesPorEntidad } = useNotificacionesStore.getState();
    await deleteNotificacionesPorEntidad(undefined, selectedServicio.id);

    toast.success('Servicio renovado exitosamente');
  } catch (error) {
    console.error('Error renovando servicio:', error);
    toast.error('Error al renovar el servicio');
  }
};
```

---

## 🧪 Estrategia de Desarrollo Paralelo

### Ruta de Prueba: `/notificaciones-test`

Para evitar romper la funcionalidad actual, implementaremos el nuevo sistema en una ruta paralela.

**Estructura de archivos:**

```
src/
├── app/(dashboard)/
│   ├── notificaciones/                      # ✅ MANTENER (versión actual)
│   │   └── page.tsx
│   └── notificaciones-test/                 # 🆕 NUEVA (versión v2.1)
│       └── page.tsx
└── components/
    └── notificaciones/
        ├── VentasProximasTable.tsx          # ✅ Actual (no tocar)
        ├── ServiciosProximosTable.tsx       # ✅ Actual (no tocar)
        ├── VentasProximasTableV2.tsx        # 🆕 Nueva versión
        ├── ServiciosProximosTableV2.tsx     # 🆕 Nueva versión
        └── AccionesVentaDialog.tsx          # 🆕 Nuevo componente
```

**Sidebar Navigation:**

```typescript
// src/components/layout/Sidebar.tsx

{
  label: 'Notificaciones',
  href: '/notificaciones',
  icon: Bell,
},
{
  label: 'Notificaciones Test',  // 🆕 TEMPORAL
  href: '/notificaciones-test',
  icon: Bell,
  badge: 'TEST'  // Badge visual para distinguir
},
```

### Flujo de Migración

1. **Fase Desarrollo:** Implementar en `/notificaciones-test`
2. **Fase Testing:** Usuario prueba ambas versiones en paralelo
3. **Fase Validación:** Comparar funcionamiento y corregir bugs
4. **Fase Migración:**
   - Eliminar `/notificaciones` (ruta y componentes antiguos)
   - Renombrar `/notificaciones-test` → `/notificaciones`
   - Renombrar componentes V2 → nombres finales
   - Actualizar Sidebar (quitar entrada "Test")

### Archivos a Crear (No Modificar Existentes)

**Nuevos archivos:**
- `src/app/(dashboard)/notificaciones-test/page.tsx`
- `src/components/notificaciones/VentasProximasTableV2.tsx`
- `src/components/notificaciones/ServiciosProximosTableV2.tsx`
- `src/components/notificaciones/AccionesVentaDialog.tsx`
- `src/components/layout/NotificationBell.tsx`
- `src/lib/services/notificationSyncService.ts`

**Archivos a modificar:**
- `src/types/notificaciones.ts` (agregar campo `resaltada`)
- `src/store/notificacionesStore.ts` (nuevas acciones)
- `src/components/layout/Sidebar.tsx` (agregar entrada temporal)
- `src/components/layout/Header.tsx` (agregar NotificationBell)
- `src/app/(dashboard)/layout.tsx` (agregar sincronización)

**Archivos a NO tocar hasta fase migración:**
- `src/app/(dashboard)/notificaciones/page.tsx`
- `src/components/notificaciones/VentasProximasTable.tsx`
- `src/components/notificaciones/ServiciosProximosTable.tsx`

---

## 🚀 Plan de Implementación

### Fase 1: Backend & Tipos (1-2 horas)
1. ✅ Actualizar tipo `Notificacion` en `src/types/notificaciones.ts`
   - Agregar campo `resaltada: boolean`
2. ✅ Crear `notificationSyncService.ts` con sincronización diaria
3. ✅ Implementar helpers: `calcularPrioridad()`, `generarTitulo()`, `prioridadSubio()`

### Fase 2: Store (1 hora)
1. ✅ Extender `notificacionesStore` con:
   - `toggleLeida()`
   - `toggleResaltada()`
   - `deleteNotificacionesPorEntidad()`
2. ✅ Testing manual del store

### Fase 3: UI - NotificationBell (2 horas)
1. ✅ Crear `NotificationBell.tsx` con lógica de colores
2. ✅ Implementar dropdown con resumen
3. ✅ Integrar en `Header.tsx`
4. ✅ Agregar sincronización en `layout.tsx`

### Fase 4: Modal & Tablas (3 horas)
1. ✅ Crear `AccionesVentaDialog.tsx` (modal con dos flujos)
2. ✅ Crear `VentasProximasTableV2.tsx`:
   - Sistema de íconos (🔔/🔕/⚠️)
   - Badges con estado resaltado
   - Toggle leída en click
   - Integrar modal
3. ✅ Crear `ServiciosProximosTableV2.tsx` (mismo patrón)

### Fase 5: Ruta Paralela (1 hora)
1. ✅ Crear `/notificaciones-test/page.tsx`
2. ✅ Agregar entrada en Sidebar con badge "TEST"
3. ✅ Integrar componentes V2

### Fase 6: Testing & Polish (1 hora)
1. ✅ Testing end-to-end de flujos
2. ✅ Verificar sincronización diaria
3. ✅ Validar colores y estados visuales
4. ✅ Probar renovación y corte

**Total Estimado:** 9-10 horas

---

## 📈 Métricas de Rendimiento

| Métrica | v1.0 (Polling) | v2.1 (Diaria) | Mejora |
|---------|----------------|---------------|--------|
| Lecturas Firebase/día | ~1,920 | ~20 | **96% reducción** |
| Sincronizaciones/día | 96 (cada 5 min) | 1 (al cargar) | **99% reducción** |
| Tiempo sincronización | <2s | <2s | Sin cambio |
| Escrituras/día | Variable | 1 por notificación* | Optimizado |

*Solo escribe si `diasRestantes` cambió (máximo 1 vez al día por notificación)

---

## 🎯 Diferencias Clave: v2.0 → v2.1

### Optimizaciones Aprobadas

1. ✅ **Ventana de sincronización:** 7 días fijos (no 30 días, no configurable)
2. ✅ **Sincronización diaria:** Una vez al día con `localStorage` (no polling cada 5 min)
3. ✅ **Estado "leída" inteligente:** Solo resetea si prioridad aumenta (no cada actualización)
4. ✅ **Campo `resaltada`:** Sistema de resaltado manual para seguimiento prioritario
5. ✅ **Jerarquía de colores:** 🟠 naranja > 🔴 rojo > 🟡 amarillo
6. ✅ **Íconos interactivos:** 🔔/🔕/⚠️ con click para toggle leída
7. ✅ **Modal dual:** Opciones (sin resaltar) vs Confirmación directa (resaltada)
8. ✅ **Desarrollo paralelo:** Implementar en `/notificaciones-test` sin romper actual

---

## 📝 Notas Finales

- El sistema NO requiere Firebase Cloud Functions (todo client-side)
- Compatible con el sistema de caché existente (5 min TTL)
- Se mantiene la página `/notificaciones` sin cambios durante desarrollo
- Nueva versión en `/notificaciones-test` para comparación directa
- Notificaciones persistentes complementan el flujo manual existente
- Auto-actualización asegura que siempre se vea la prioridad más reciente
- Sistema de resaltado permite al admin marcar notificaciones críticas

---

## 🔄 Diagrama de Flujo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│ USUARIO CARGA DASHBOARD (Primera vez del día)                   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Verificar localStorage.lastNotificationSync                      │
│ ├─ Ya sincronizado hoy? → SKIP                                  │
│ └─ NO → Ejecutar sincronizarNotificaciones()                    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ sincronizarNotificaciones()                                     │
│ ├─ Query ventas próximas (7 días) + vencidas                   │
│ ├─ Query servicios próximos (7 días) + vencidos                │
│ └─ Para cada venta/servicio:                                    │
│    ├─ Calcular diasRestantes (número exacto)                    │
│    ├─ Existe notificación?                                      │
│    │  ├─ SÍ → Actualizar SI diasRestantes cambió                │
│    │  │       - Solo resetear leida si prioridad aumentó        │
│    │  │       - Mantener resaltada sin cambios                  │
│    │  └─ NO → Crear nueva notificación                          │
│    └─ Guardar localStorage.lastNotificationSync = today         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ NOTIFICACIONES EN FIREBASE                                       │
│ ├─ Venta 1: diasRestantes=15, prioridad='baja', resaltada=false │
│ ├─ Venta 2: diasRestantes=3, prioridad='alta', resaltada=true   │
│ └─ Venta 3: diasRestantes=-2, prioridad='critica', resaltada=true│
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ BELL ICON EN HEADER                                             │
│ ├─ Badge: 3 (2 resaltadas + 1 crítica no leída)                │
│ ├─ Color: 🟠 NARANJA (hay resaltadas)                           │
│ └─ Dropdown:                                                    │
│    ├─ "Tienes 3 alerta(s) pendiente(s)"                        │
│    ├─ Ventas por vencer: 2                                      │
│    ├─ Servicios por pagar: 1                                    │
│    └─ [Ver todas las notificaciones →]                          │
└─────────────────────────────────────────────────────────────────┘
                            │
                   Usuario hace clic
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ /notificaciones-test PAGE                                       │
│ ├─ VentasProximasTableV2                                        │
│ │  ├─ Venta 1 (15 días): 🔔 azul [15 días restantes]           │
│ │  ├─ Venta 2 (3 días): ⚠️ naranja [⚠️ 3 días restantes]       │
│ │  └─ Venta 3 (-2 días): ⚠️ naranja [⚠️ 2 días vencida]        │
│ └─ ServiciosProximosTableV2                                     │
│    └─ Servicio 1: Similar patrón                                │
└─────────────────────────────────────────────────────────────────┘
                            │
              ┌──────────────┴──────────────┐
              │                             │
       Click Ícono 🔔                 Click "Acciones"
       (Toggle leída)                      │
              │                             ▼
         🔔 → 🔕                  ┌─────────────────┐
                                  │ Modal aparece   │
                                  └─────────────────┘
                                          │
                      ┌───────────────────┴───────────────────┐
                      │                                       │
              NO Resaltada                              YA Resaltada
                      │                                       │
                      ▼                                       ▼
         ┌─────────────────────────┐             ┌─────────────────────┐
         │ Modal con opciones:     │             │ Modal confirmación: │
         │ ○ Cortar servicio       │             │ ⚠️ Esto hará:       │
         │ ○ Resaltar              │             │ • Inactivar         │
         │                         │             │ • Liberar perfil    │
         │ [Confirmar]             │             │ • Eliminar notif    │
         └─────────────────────────┘             │                     │
                      │                          │ [Cortar]            │
                      │                          └─────────────────────┘
                      ▼                                       │
            Usuario elige acción                             │
                      │                                       │
         ┌────────────┴────────────┐                         │
         │                         │                         │
    CORTAR                    RESALTAR                   CORTAR
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ • Estado inact  │      │ • resaltada=true│      │ • Estado inact  │
│ • Liberar perfil│      │ • Badge 🟠      │      │ • Liberar perfil│
│ • -1 contador   │      │ • Ícono ⚠️      │      │ • -1 contador   │
│ • Eliminar notif│      │                 │      │ • Eliminar notif│
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

**Versión 2.1 - Diseño refinado completado y aprobado. Listo para implementación.**
