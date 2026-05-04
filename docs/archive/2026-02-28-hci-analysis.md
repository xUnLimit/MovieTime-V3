# Análisis HCI (Human-Computer Interaction) — MovieTime System

**Fecha:** 28 de febrero de 2026
**Alcance:** Todo el sistema (Dashboard, Servicios, Ventas, Usuarios, Categorías, Métodos de Pago, Notificaciones, Layout, Componentes Compartidos)

---

## Resumen Ejecutivo

Se identificaron **~140 problemas** de HCI organizados en 10 categorías. A continuación se presentan agrupados por prioridad y tipo, con archivos y líneas específicas.

---

## 1. ESTADOS DE CARGA Y FEEDBACK VISUAL

### Crítico

| # | Problema | Archivo | Líneas |
|---|----------|---------|--------|
| 1.1 | MetricCards usan `'...'` como indicador de carga — sin skeleton ni spinner | `DashboardMetrics.tsx` | 36, 45, 64, 73 |
| 1.2 | Empty states y loading states son idénticos en tablas — el usuario no puede distinguir "cargando" de "sin datos" | `VentasTable.tsx` | 306-313 |
| 1.3 | Página de detalle de venta no muestra skeleton/spinner mientras carga | `ventas/[id]/page.tsx` | 639-668 |
| 1.4 | Operaciones async (renovar, eliminar, cortar) no muestran indicador de carga | `VentasProximasTable.tsx`, `ServiciosProximosTable.tsx` | Múltiples |

### Alto

| # | Problema | Archivo | Líneas |
|---|----------|---------|--------|
| 1.5 | Loading skeletons tienen alturas diferentes al contenido renderizado — causa layout shift | `DashboardMetrics.tsx`, `IngresosVsGastosChart.tsx` | Múltiples |
| 1.6 | Tabla `UsuarioDetails` no tiene hover en filas — elementos interactivos (copiar, acciones) no son obvios | `UsuarioDetails.tsx` | 248-389 |
| 1.7 | Selects de periodo en gráficos no muestran feedback al cambiar — el chart cambia abruptamente | `IngresosVsGastosChart.tsx`, `CrecimientoUsuarios.tsx` | ~97 |
| 1.8 | Paginación no muestra estado de carga entre páginas | `servicios/[id]/page.tsx` | 57-65 |

---

## 2. ESTADOS VACÍOS (EMPTY STATES)

### Alto

| # | Problema | Archivo | Líneas |
|---|----------|---------|--------|
| 2.1 | Mensajes genéricos que no distinguen entre "sin datos", "sin resultados de búsqueda" o "filtro vacío" | `ServiciosCategoriaTable.tsx`, `VentasTable.tsx`, `UsuariosMetodosPagoTable.tsx` | Múltiples |
| 2.2 | Empty states sin call-to-action — no guía al usuario sobre qué hacer | `VentasForm.tsx` (1257), `EmptyState.tsx` | Múltiples |
| 2.3 | Gráficos de dashboard no muestran mensaje cuando no hay datos — quedan en blanco | `IngresosVsGastosChart.tsx` | — |
| 2.4 | Métricas muestran `0` sin distinguir entre "no hay datos aún" y "el valor es 0" | `ServiciosMetrics.tsx`, `UsuariosMetrics.tsx` | Múltiples |

---

## 3. CONSISTENCIA

### Crítico

| # | Problema | Archivo |
|---|----------|---------|
| 3.1 | Formato de fechas diferente entre componentes: `d 'de' MMM` vs `dd 'de' MMMM` | `ServiciosCategoriaTable.tsx` (109) vs `ServiciosCategoriaTableDetalle.tsx` (180) |
| 3.2 | Terminología inconsistente: "Ciclo de Pago" vs "Ciclo de facturación" para el mismo concepto | `VentasTable.tsx` (179) vs `PagoDialog.tsx` (353) |
| 3.3 | Emoji 🔄 en una tabla vs icono `RefreshCw` en otra para "Renovaciones" | `ServiciosCategoriaTable.tsx` (125) vs `ServiciosCategoriaTableDetalle.tsx` (238) |
| 3.4 | Error de tilde: "Informacion de la Venta" vs "Información de la venta" | `VentasForm.tsx` vs `VentasEditForm.tsx` |

### Alto

| # | Problema | Archivo |
|---|----------|---------|
| 3.5 | Padding inconsistente en CardHeader de dashboard: `p-0 px-4 pb-2` vs `pt-3 pb-2 px-6` vs `pb-2` | Múltiples componentes dashboard |
| 3.6 | Grid gap inconsistente en métricas: `gap-4` (Usuarios) vs `gap-3` (Categorías, Notificaciones) | Métricas de todos los módulos |
| 3.7 | Select heights inconsistentes en gráficos: `h-8 text-xs` vs `h-7 text-xs` | `IngresosVsGastosChart.tsx` vs `CrecimientoUsuarios.tsx` |
| 3.8 | Mensajes de error con estilos hardcoded repetidos en cada formulario sin componente centralizado | `ServicioForm.tsx`, `ServicioDialog.tsx`, etc. |
| 3.9 | Posicionamiento de errores de validación inconsistente: debajo del campo vs encima | `UsuarioForm.tsx` (273) vs `MetodoPagoForm.tsx` (441) |
| 3.10 | Font sizes en gráficos: `fontSize={10}`, `fontSize={11}`, `fontSize={12}` sin escala tipográfica consistente | Dashboard charts |
| 3.11 | Patron de "ver todo" inconsistente: `<Link>` dentro de `<Button>` vs `<Button variant="ghost">` con `<Link>` | `RecentActivity.tsx` vs `UrgentNotifications.tsx` |

---

## 4. ACCESIBILIDAD

### Crítico

| # | Problema | Archivo | Líneas |
|---|----------|---------|--------|
| 4.1 | Botones de solo icono sin `aria-label` en tablas (copiar, editar, eliminar) | `ServiciosTable.tsx` (114-123, 160-169), `VentasTable.tsx` (321-347) |
| 4.2 | Color como único diferenciador de tipos de actividad (verde=crear, azul=editar, rojo=eliminar) | `RecentActivity.tsx` (87) |
| 4.3 | Puntos de prioridad en notificaciones son solo color — sin texto, icono u otro indicador | `UrgentNotifications.tsx` (69), `NotificationBell.tsx` (64) |
| 4.4 | Perfiles ocupados/disponibles diferenciados solo por color rojo/verde | `ServiciosCategoriaTable.tsx` (131-145), `ServiciosCategoriaTableDetalle.tsx` (257-263) |
| 4.5 | Inputs de búsqueda sin `aria-label` | `VentasTable.tsx` (282), múltiples tablas |
| 4.6 | Símbolo de moneda leído como entidad separada del número por screen readers | `PagoDialog.tsx` (427-441), `VentasForm.tsx` |

### Alto

| # | Problema | Archivo |
|---|----------|---------|
| 4.7 | Iconos de MetricCard sin `aria-label` o `title` (TrendingUp, TrendingDown, Wallet) | `DashboardMetrics.tsx` (38, 47, 57) |
| 4.8 | Touch targets de 32x32px en botones de acción de tablas — debajo del mínimo WCAG de 44x44px | `VentasTable.tsx` (323) |
| 4.9 | Breadcrumbs no usan `<nav aria-label="breadcrumb">` semántico | `servicios/page.tsx` (77-78), múltiples páginas |
| 4.10 | Botones de sort en DataTable sin `aria-pressed` | `DataTable.tsx` (189) |
| 4.11 | Contraste potencialmente bajo en `text-muted-foreground` en modo oscuro para headers de tabla | `VentaPagosTable.tsx` (81) |
| 4.12 | `noValidate` en formularios desactiva validación nativa — si JS falla, no hay validación | `VentasEditForm.tsx` (578) |

---

## 5. JERARQUÍA DE INFORMACIÓN Y CARGA COGNITIVA

### Crítico

| # | Problema | Archivo | Líneas |
|---|----------|---------|--------|
| 5.1 | Formulario de ventas con 10+ campos visibles sin agrupación visual (categoría, servicio, plan, perfil, estado, precio, descuento, fechas, notas) | `VentasForm.tsx` | 804-1225 |
| 5.2 | Tabla `UsuarioDetails` con 11 columnas sin priorización visual | `UsuarioDetails.tsx` | 250-261 |
| 5.3 | `CategoriasTable` en /servicios con 10 columnas de datos financieros — difícil de escanear | `CategoriasTable.tsx` | 183-273 |

### Alto

| # | Problema | Archivo |
|---|----------|---------|
| 5.4 | 5 MetricCards con texto `text-sm` todas del mismo tamaño — no resalta qué es más importante | `DashboardMetrics.tsx` (33) |
| 5.5 | "Gastos Totales" y "Gasto Mensual Esperado" fácilmente confundibles — sin agrupación visual | `DashboardMetrics.tsx` (34-79) |
| 5.6 | Descripción de MetricCard truncada con `line-clamp-1` sin tooltip | `MetricCard.tsx` (88) |
| 5.7 | Detalle de venta: 9 campos en grid 3x3 sin agrupación por relación (fechas, servicio, pago) | `ventas/[id]/page.tsx` (726-809) |
| 5.8 | Menu dropdown de notificaciones con 6 acciones sin agrupación (comunicación, lifecycle, destructivas) | `VentasProximasTable.tsx` (752-775) |
| 5.9 | Acciones de detalle de venta (Renovar, Editar, Eliminar) todas con mismo peso visual | `ventas/[id]/page.tsx` (690-711) |

---

## 6. AFFORDANCES (SEÑALES DE INTERACTIVIDAD)

### Alto

| # | Problema | Archivo | Líneas |
|---|----------|---------|--------|
| 6.1 | Dropdown con valor seleccionado parece texto readonly — falta chevron visible | `VentasForm.tsx` | 715 |
| 6.2 | Inputs readonly con estilo que parece editable (iconos de calendario en campos de solo lectura) | `ventas/[id]/page.tsx` | 774-784 |
| 6.3 | Botón WhatsApp estilizado como link de texto — no parece clickeable | `ClientesTable.tsx` | 160 |
| 6.4 | Filas de actividad reciente parecen interactivas (iconos de color) pero no son clickeables | `RecentActivity.tsx` | 84-104 |
| 6.5 | Tab deshabilitado con `opacity-50` pero sigue siendo focusable con teclado | `ServicioForm.tsx` | 429-434 |
| 6.6 | Botón deshabilitado con texto explicativo difícil de leer por la opacidad reducida | `VentasForm.tsx` | 846, 891, 928 |

---

## 7. FORMULARIOS (UX)

### Crítico

| # | Problema | Archivo |
|---|----------|---------|
| 7.1 | No hay confirmación al salir de formulario con cambios sin guardar | `ServicioForm.tsx` (346), `VentasForm.tsx`, `VentasEditForm.tsx` |
| 7.2 | No hay indicador visual de cambios sin guardar (asterisco, banner, etc.) | `VentasEditForm.tsx` (373-392) |

### Alto

| # | Problema | Archivo |
|---|----------|---------|
| 7.3 | Formularios sin agrupación visual de secciones (sin dividers entre "Identificación", "Pago", "Fechas") | `ServicioForm.tsx` (438-796), `VentasForm.tsx` |
| 7.4 | "Fecha de vencimiento" se auto-calcula pero no hay indicador visual del cambio | `ServicioForm.tsx` (240-258) |
| 7.5 | Botón "Siguiente" deshabilitado sin tooltip explicando por qué | `ServicioForm.tsx` (813, 922), `VentasEditForm.tsx` (773) |
| 7.6 | Validación produce flash de errores — mensajes aparecen/desaparecen creando UI inestable | `ServicioForm.tsx` (191-238) |
| 7.7 | Campos condicionales sin explicación clara — campos que aparecen/desaparecen confunden | `MetodoPagoForm.tsx` (597, 653), `VentasForm.tsx` |
| 7.8 | Símbolo de moneda como decorador `position: absolute` — no claro si es prefix del input | `ServicioForm.tsx` (547-559), `ServicioEditForm.tsx` (515-544) |
| 7.9 | Input numérico inconsistente: custom `onKeyDown` vs `inputMode="numeric"` vs `type="number"` | `ServicioForm.tsx` (560-579, 748-762) |
| 7.10 | Toggle de notificación WhatsApp se resetea automáticamente al cambiar estado a inactivo — sin aviso | `VentasForm.tsx` (157-161) |
| 7.11 | Ediciones del mensaje WhatsApp se pierden al cerrar/abrir toggle — sin warning | `VentasForm.tsx` (463-465) |

---

## 8. NAVEGACIÓN

### Alto

| # | Problema | Archivo |
|---|----------|---------|
| 8.1 | Back button posicionado inconsistentemente entre páginas | `servicios/crear/page.tsx` (19-22) vs `servicios/[id]/page.tsx` (158-165) |
| 8.2 | No hay indicador de paso en formularios multi-tab ("Paso 1 de 2") | `VentasForm.tsx`, `VentasEditForm.tsx` (598-600) |
| 8.3 | Sidebar colapsado no muestra indicación visual del item activo | Layout `Sidebar.tsx` |
| 8.4 | Botón "Cancelar" en formularios navega sin verificar cambios no guardados | `ServicioForm.tsx` (346), `CategoriaForm.tsx` (376) |

---

## 9. TABLAS

### Alto

| # | Problema | Archivo |
|---|----------|---------|
| 9.1 | Columna "Consumo del Pago" muestra texto + barra de progreso — ocupa mucho ancho en mobile | `VentasTable.tsx` | 230 |
| 9.2 | Tabla de pagos con 9 columnas de width fijo que no suman 100% correctamente | `VentaPagosTable.tsx` (69-78) |
| 9.3 | Celda de perfiles con 5+ iconos se vuelve ilegible para servicios con muchos perfiles | `ServiciosCategoriaTableDetalle.tsx` (249-275) |
| 9.4 | Sort no se preserva entre páginas de paginación | `DataTable.tsx` |
| 9.5 | Alineación de columnas inconsistente entre tablas del mismo módulo | Múltiples tablas |
| 9.6 | `ServiciosCategoriaTable` usa tabla custom sin DataTable — no tiene sort, paginación limitada | `ServiciosCategoriaTable.tsx` |

---

## 10. RESPONSIVIDAD

### Alto

| # | Problema | Archivo |
|---|----------|---------|
| 10.1 | 5 MetricCards en `grid-cols-2` en mobile = 3 filas, mucho espacio vertical | `DashboardMetrics.tsx` (33) |
| 10.2 | Descripción de gráfico desaparece en mobile sin reemplazo visual | `IngresosVsGastosChart.tsx` (93) |
| 10.3 | Modal de servicio puede ocupar toda la pantalla en mobile sin scroll visible a botones | `ServicioDialog.tsx` (155) |
| 10.4 | Tablas con 8-11 columnas son difíciles de leer en tablets (1024px) | Múltiples tablas |
| 10.5 | Dropdown de acciones con `align="end"` puede desbordar en pantallas estrechas | `ServiciosCategoriaTableDetalle.tsx` (336-366) |
| 10.6 | Formularios en `grid-cols-1 md:grid-cols-2` sin breakpoint intermedio para tablets | `ServicioForm.tsx` (438-485) |

---

## 11. MANEJO DE ERRORES

### Alto

| # | Problema | Archivo |
|---|----------|---------|
| 11.1 | Gráficos de dashboard no muestran estado de error — si Firebase falla, el skeleton queda infinito | `IngresosVsGastosChart.tsx`, `CrecimientoUsuarios.tsx`, `RevenueByCategory.tsx` |
| 11.2 | Delete confirmation muestra "undefined" si `servicioToDelete` es null | `ServiciosTable.tsx` (180) |
| 11.3 | Timestamp malformado en actividad reciente puede hacer crash a `formatDistanceToNow` | `RecentActivity.tsx` (98-101) |
| 11.4 | Checkbox de "Eliminar registros de pago" en dialog de eliminación con consecuencias no suficientemente visibles | `ConfirmDeleteVentaDialog.tsx` (64-82) |

---

## Priorización Recomendada

### Tier 1 — Impacto alto, esfuerzo bajo
1. Agregar `aria-label` a botones de solo icono (4.1)
2. Corregir tilde "Informacion" → "Información" (3.4)
3. Unificar terminología "Ciclo de Pago" (3.2)
4. Reemplazar emoji 🔄 por icono `RefreshCw` (3.3)
5. Unificar formato de fechas (3.1)
6. Agregar tooltip a MetricCard descriptions truncadas (5.6)
7. Diferenciar empty states por contexto (2.1)

### Tier 2 — Impacto alto, esfuerzo medio
8. Agregar confirmación al salir de formularios con cambios (7.1, 7.2)
9. Agregar indicador de paso "1 de 2" en formularios multi-tab (8.2)
10. Agrupar visualmente campos de formularios con secciones (7.3)
11. Mejorar affordance de botones deshabilitados con tooltip (6.6, 7.5)
12. Agregar loading states a operaciones async (1.4)
13. Agrupar acciones en dropdowns por tipo (5.8)

### Tier 3 — Impacto medio, esfuerzo medio
14. Unificar padding/spacing en cards de dashboard (3.5, 3.6)
15. Mejorar responsividad de MetricCards en mobile (10.1)
16. Reducir columnas en tablas densas o agregar responsive hiding (9.1, 5.2, 5.3)
17. Agregar estados de error a gráficos (11.1)
18. Mejorar accesibilidad de colores (indicadores no solo color) (4.2, 4.3, 4.4)

### Tier 4 — Mejoras de polish
19. Transiciones suaves entre loading → loaded en gráficos (1.7)
20. Hover states en filas de tablas de `UsuarioDetails` (1.6)
21. Unificar estilos de error de validación en componente compartido (3.8, 3.9)
22. Font size scale consistente en gráficos (3.10)
23. Breadcrumbs semánticos con `<nav>` (4.9)
