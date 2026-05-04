# Monitoreo de Lecturas de Firebase

Este documento explica cómo monitorear las lecturas de Firebase en el navegador durante el desarrollo para verificar las optimizaciones del proyecto.

## 🎯 Objetivo

Reducir las lecturas de Firebase en un ~90-96% utilizando:
- Server-side pagination con cursores
- `getCount()` para métricas (gratis en Spark plan)
- Module-level cache (5 min TTL)
- Denormalización de campos frecuentes

## 📊 Sistema de Logs en Consola

El proyecto tiene un sistema de logging completo que registra **todas las operaciones de Firebase** en la consola del navegador (solo en desarrollo).

### Tipos de Operaciones y Colores

Cada operación usa un color distintivo para facilitar la lectura:

| Operación | Color | Badge | Costo | Ejemplo |
|-----------|-------|-------|-------|---------|
| **getAll** | Verde 🟢 | `[Firestore] getAll` | N docs | `getAll (usuarios) → 50 docs · 120ms` |
| **getById** | Verde 🟢 | `[Firestore] getById` | 1 doc | `getById (usuarios/abc123) → encontrado · 45ms` |
| **query** | Verde 🟢 | `[Firestore] query` | N docs | `query (ventas where estado == activo) → 25 docs · 90ms` |
| **paginated** | Azul 🔵 | `[Firestore] paginated` | pageSize + 1 | `paginated (usuarios) → 10 docs · 80ms` |
| **count** | Morado 🟣 | `[Firestore] count` | **0 docs** (gratis) | `count (usuarios where tipo == cliente) → 35 · 30ms` |
| **Cache Hit** | Naranja 🟠 | `[Cache] Hit` | **0 reads** | `Hit (usuarios) → sin lectura a Firestore` |
| **Ventas Cache Hit** | Verde 🟢 | `[VentasUsuarioCache] Hit` | **0 reads** | `HIT · user abc12345 · age 45s` |

## 📈 Cómo Monitorear las Lecturas

### 1. Abrir la Consola del Navegador

```
Chrome/Edge: F12 o Ctrl+Shift+I
Firefox: F12 o Ctrl+Shift+K
Safari: Cmd+Option+I
```

### 2. Filtrar por Firebase

En la barra de filtro de la consola, escribe:
```
Firestore
```

Esto mostrará solo las operaciones de Firebase.

### 3. Interpretar los Logs

Cada log tiene el formato:
```
[Firestore] <operación> (<colección> [where ...]) → <resultado> · <tiempo>ms
```

**Ejemplos:**

```javascript
// ✅ OPTIMIZADO - Paginación (11 lecturas)
[Firestore] paginated (usuarios) → 10 docs · 85ms

// ✅ OPTIMIZADO - Count (0 lecturas)
[Firestore] count (usuarios where tipo == cliente) → 35 · 25ms

// ✅ OPTIMIZADO - Cache hit (0 lecturas)
[Cache] Hit (usuarios) → sin lectura a Firestore

// ⚠️ SIN OPTIMIZAR - getAll (50 lecturas)
[Firestore] getAll (usuarios) → 50 docs · 150ms

// ✅ OPTIMIZADO - Query selectiva (4 lecturas)
[Firestore] query (ventas where clienteId == abc123) → 4 docs · 60ms
```

## 🧪 Escenarios de Prueba

### Test 1: Primera Visita a Usuarios
**Objetivo:** Verificar que la paginación funciona

**Pasos:**
1. Abrir la app (F5 para limpiar cache)
2. Navegar a `/usuarios`
3. Verificar en consola:
   ```
   [Firestore] paginated (usuarios) → 10 docs · Xms
   [Firestore] count (usuarios) → N · Xms
   [Firestore] count (usuarios where tipo == cliente) → N · Xms
   [Firestore] count (usuarios where tipo == revendedor) → N · Xms
   ```

**Resultado esperado:** ~11-13 lecturas totales

### Test 2: Segunda Visita a Usuarios (dentro de 5 min)
**Objetivo:** Verificar que el cache funciona

**Pasos:**
1. Salir de `/usuarios` (ir a otra página)
2. Volver a `/usuarios` en menos de 5 minutos
3. Verificar en consola:
   ```
   [Cache] Hit (usuarios) → sin lectura a Firestore
   ```

**Resultado esperado:** 0 lecturas

### Test 3: Cambio de Tab (Clientes → Revendedores)
**Objetivo:** Verificar que los filtros no hacen re-fetch innecesario

**Pasos:**
1. En `/usuarios`, tab "Todos"
2. Cambiar a tab "Clientes"
3. Cambiar a tab "Revendedores"
4. Verificar en consola

**Resultado esperado:** Cada cambio de tab causa 11 lecturas (paginación nueva)

### Test 4: Detalle de Usuario
**Objetivo:** Verificar que se usa getById en lugar de fetchAll

**Pasos:**
1. En `/usuarios`, click en "Ver detalles" de un usuario
2. Verificar en consola:
   ```
   [Firestore] getById (usuarios/abc123) → encontrado · Xms
   [Firestore] query (ventas where clienteId == abc123) → N docs · Xms
   ```

**Resultado esperado:** 1 lectura (getById) + N lecturas de ventas (donde N = número de ventas del usuario)

### Test 5: Ventas Paginadas
**Objetivo:** Verificar paginación de ventas

**Pasos:**
1. Navegar a `/ventas`
2. Verificar en consola:
   ```
   [Firestore] paginated (Ventas) → 10 docs · Xms
   ```

**Resultado esperado:** 11 lecturas (10 + 1 para hasMore)

### Test 6: Servicios con Métricas
**Objetivo:** Verificar que las métricas usan count (no getAll)

**Pasos:**
1. Navegar a `/servicios`
2. Verificar en consola:
   ```
   [Firestore] count (servicios) → N · Xms
   [Firestore] count (servicios where activo == true) → N · Xms
   [Firestore] count (categorias where activo == true) → N · Xms
   ```

**Resultado esperado:** 3 count queries (0 lecturas de docs) + 11 lecturas de paginación

### Test 7: Categorías Métricas
**Objetivo:** Verificar optimización de métricas

**Pasos:**
1. Navegar a `/categorias`
2. Verificar en consola:
   ```
   [Firestore] count (categorias) → N · Xms
   [Firestore] count (categorias where tipo in [cliente, ambos]) → N · Xms
   [Firestore] count (categorias where tipo in [revendedor, ambos]) → N · Xms
   ```

**Resultado esperado:** 3 count queries (0 lecturas)

### Test 8: Métodos de Pago Métricas
**Objetivo:** Verificar optimización de métricas

**Pasos:**
1. Navegar a `/metodos-pago`
2. Verificar en consola:
   ```
   [Firestore] count (metodosPago) → N · Xms
   [Firestore] count (metodosPago where asociadoA == usuario) → N · Xms
   [Firestore] count (metodosPago where asociadoA == servicio) → N · Xms
   ```

**Resultado esperado:** 3 count queries (0 lecturas)

### Test 9: Notificaciones con Paginación
**Objetivo:** Verificar paginación de notificaciones

**Pasos:**
1. Navegar a `/notificaciones`
2. Verificar en consola:
   ```
   [Firestore] paginated (notificaciones) → 50 docs · Xms
   ```

**Resultado esperado:** 51 lecturas (50 + 1 para hasMore)

### Test 10: Log de Actividad con Paginación
**Objetivo:** Verificar paginación de logs

**Pasos:**
1. Navegar a `/log-actividad`
2. Verificar en consola:
   ```
   [Firestore] paginated (activityLog) → 50 docs · Xms
   ```

**Resultado esperado:** 51 lecturas (50 + 1 para hasMore)

## 📉 Métricas de Éxito

### Antes de Optimización (ejemplo con 50 usuarios, 100 servicios, 200 ventas)

| Módulo | Operación | Lecturas |
|--------|-----------|----------|
| Usuarios Lista | `getAll(usuarios)` | 50 |
| Usuarios Métricas | `getAll(usuarios).filter()` | 50 (reutiliza) |
| Usuarios Detalle | `getAll(usuarios).find()` | 50 |
| Servicios Lista | `getAll(servicios)` | 100 |
| Servicios Métricas | `getAll(servicios).filter()` | 100 (reutiliza) |
| Ventas Lista | `getAll(ventas)` | 200 |
| Ventas Métricas | `getAll(ventas).reduce()` | 200 (reutiliza) |
| **TOTAL PRIMERA VISITA** | | **~750 lecturas** |

### Después de Optimización (mismo dataset)

| Módulo | Operación | Lecturas |
|--------|-----------|----------|
| Usuarios Lista | `getPaginated(usuarios, 10)` | 11 |
| Usuarios Métricas | `getCount() × 4` | 0 (gratis) |
| Usuarios Detalle | `getById(usuarios, id)` | 1 |
| Servicios Lista | `getPaginated(servicios, 10)` | 11 |
| Servicios Métricas | `getCount() × 3` | 0 (gratis) |
| Ventas Lista | `getPaginated(ventas, 10)` | 11 |
| Ventas Métricas | `getCount() × 3` | 0 (gratis) |
| **TOTAL PRIMERA VISITA** | | **~34 lecturas** |
| **VISITAS POSTERIORES (5 min)** | Cache hits | **0 lecturas** |

**Reducción: 95.5%** (de 750 a 34 lecturas)

## 🔍 Contador Global de Lecturas

Para tener un contador global acumulativo de lecturas, puedes ejecutar este script en la consola:

```javascript
// Ejecutar una vez al inicio de la sesión
window.firestoreReadCounter = {
  total: 0,
  byOperation: {},
  byCollection: {},

  log(operation, collection, count) {
    this.total += count;
    this.byOperation[operation] = (this.byOperation[operation] || 0) + count;
    this.byCollection[collection] = (this.byCollection[collection] || 0) + count;
  },

  reset() {
    this.total = 0;
    this.byOperation = {};
    this.byCollection = {};
  },

  report() {
    console.log('%c═══ FIREBASE READS REPORT ═══', 'font-size:16px;font-weight:bold;color:#4CAF50');
    console.log('Total Reads:', this.total);
    console.log('By Operation:', this.byOperation);
    console.log('By Collection:', this.byCollection);
  }
};

// Ver reporte en cualquier momento
firestoreReadCounter.report();

// Resetear contador
firestoreReadCounter.reset();
```

## 🚨 Señales de Alerta (Red Flags)

Si ves estos patrones en los logs, HAY UN PROBLEMA:

❌ **`getAll()` en módulos con +10 items**
```javascript
[Firestore] getAll (usuarios) → 100 docs · 200ms
```
→ **Solución:** Implementar paginación con `useServerPagination`

❌ **Múltiples `getAll()` de la misma colección en una página**
```javascript
[Firestore] getAll (servicios) → 50 docs · 120ms
[Firestore] getAll (servicios) → 50 docs · 115ms
[Firestore] getAll (servicios) → 50 docs · 118ms
```
→ **Solución:** Implementar cache en el store (5 min TTL)

❌ **`getAll()` en páginas de detalle**
```javascript
[Firestore] getAll (usuarios) → 100 docs · 180ms  // Para encontrar 1 usuario
```
→ **Solución:** Usar `getById(collection, id)` directamente

❌ **Calcular counts con `.length` después de `getAll()`**
```javascript
[Firestore] getAll (ventas) → 200 docs · 250ms  // Solo para contar
```
→ **Solución:** Usar `getCount()` que es gratis

❌ **Sin cache en navegación repetida**
```javascript
// Usuario navega: /usuarios → /servicios → /usuarios
[Firestore] getAll (usuarios) → 50 docs · 120ms  // Primera visita
[Firestore] getAll (usuarios) → 50 docs · 115ms  // Segunda visita (debería ser cache hit)
```
→ **Solución:** Implementar cache con TTL de 5 minutos

## ✅ Patrones Correctos (Green Flags)

Estos logs indican que las optimizaciones están funcionando:

✅ **Paginación en listas**
```javascript
[Firestore] paginated (usuarios) → 10 docs · 85ms
```

✅ **Counts para métricas**
```javascript
[Firestore] count (usuarios) → 50 · 25ms
[Firestore] count (usuarios where tipo == cliente) → 35 · 20ms
```

✅ **Cache hits en navegación repetida**
```javascript
[Cache] Hit (usuarios) → sin lectura a Firestore
```

✅ **getById en páginas de detalle**
```javascript
[Firestore] getById (usuarios/abc123) → encontrado · 45ms
```

✅ **Query selectiva con filtros**
```javascript
[Firestore] query (ventas where clienteId == abc123) → 4 docs · 60ms
```

## 🎓 Consejos para el Desarrollo

1. **Siempre abre la consola** cuando navegues por la app en desarrollo
2. **Filtra por "Firestore"** para ver solo operaciones relevantes
3. **Cuenta las lecturas** en cada página (debería ser <20 por módulo)
4. **Verifica el cache** navegando ida y vuelta entre páginas
5. **Usa el contador global** para sesiones largas de testing
6. **Compara antes/después** al implementar optimizaciones

## 📚 Referencias

- **Usuarios** - Módulo de referencia con todas las optimizaciones
- **docs/PAGINATION_AND_CACHE_PATTERN.md** - Guía completa del patrón
- **Plan de Optimización** - `.claude/plans/functional-leaping-pike.md`

---

**Última actualización:** Sprint 3 completo (Feb 6, 2026)
