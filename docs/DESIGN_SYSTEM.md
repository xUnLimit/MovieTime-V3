# MovieTime PTY - Design System

**Estado:** Vigente  
**Version:** 1.0  
**Fecha:** Mayo 2026  
**Alcance:** UI de producto, dashboards, tablas, formularios, dialogos y componentes compartidos.

---

## 1. Proposito

Este documento define el contrato visual y de interaccion para MovieTime PTY. Su objetivo no es crear una capa estetica aislada, sino asegurar que cada pantalla nueva o refactorizada mantenga una experiencia consistente, densa, operativa y escalable.

MovieTime PTY es una herramienta de gestion. La interfaz debe priorizar lectura rapida, comparacion, accion repetida y baja friccion. No debe sentirse como landing page, portafolio, brochure ni dashboard decorativo.

---

## 2. Principios Obligatorios

1. **Producto operativo antes que presentacion.** La primera pantalla debe mostrar datos, acciones o controles utiles. No usar heroes, bloques promocionales ni composiciones de marketing.
2. **Densidad controlada.** Las vistas deben permitir escanear tablas, metricas y estados sin ruido visual. El espacio en blanco se usa para jerarquia, no para decorar.
3. **Consistencia sobre creatividad local.** Nuevas pantallas deben reutilizar tokens, componentes y patrones existentes antes de crear variantes.
4. **Estados explicitos.** Todo dato remoto debe tener estado de carga, vacio y error. No se permite dejar textos como `Calculando...` como sustituto permanente del estado `loading`.
5. **Responsabilidad clara.** React Query maneja lecturas remotas; Zustand maneja estado UI y escrituras optimistas; los componentes no deben inventar caches locales de servidor.
6. **Accesibilidad basica siempre.** Todo boton icon-only requiere nombre accesible o tooltip. El color no puede ser la unica forma de comunicar estado.
7. **Responsive sin romper layout.** Las tablas pueden hacer scroll horizontal controlado; los textos no deben superponerse ni desbordar botones, cards o tabs.
8. **Sin decoracion gratuita.** No usar orbs, blobs, bokeh, fondos degradados decorativos ni ilustraciones SVG para rellenar espacios.

---

## 3. Lenguaje Visual

### 3.1 Tema

El producto es **dark-first** y debe usar los tokens globales definidos en `src/app/globals.css`.

Tokens base:

- `bg-background` para el fondo principal de paginas y tablas.
- `bg-card` para superficies elevadas o agrupaciones puntuales.
- `text-foreground` para contenido principal.
- `text-muted-foreground` para metadatos, subtitulos y columnas auxiliares.
- `border-border` para separadores, cards, tablas y controles.
- `ring-ring` para foco visible.
- `destructive` para errores, eliminacion o estados peligrosos.

No usar colores hardcodeados salvo que ya sean parte de un patron semantico local, por ejemplo `text-green-500` para activo o `bg-blue-500` como acento de metrica.

### 3.2 Color Semantico

Los colores de acento deben comunicar categoria o estado:

| Uso | Color recomendado | Ejemplos |
|---|---|---|
| Primario / marca | `primary` | Accion principal, foco |
| Exito / activo | `green` / `emerald` | Ventas activas, disponible |
| Error / inactivo | `red` / `destructive` | Fallos, ventas inactivas |
| Informacion | `blue` | Calendario, datos esperados |
| Dinero / ingreso | `orange` | Ingresos, pagos |
| Volumen / total | `purple` | Totales, conteos generales |

Reglas:

- No crear pantallas dominadas por una sola familia de color.
- No usar degradados como fondo de seccion.
- No usar color para reemplazar texto, icono o etiqueta.
- En tablas, preferir badges o texto claro antes que fondos saturados.

### 3.3 Tipografia

La fuente base es el sistema definido por `--font-system`.

Escala recomendada:

- Pagina: `text-2xl` o `text-3xl` solo para titulos principales.
- Cards compactas: `text-sm` para titulo y `text-xl`/`text-2xl` para valor.
- Tablas: `text-sm` o menor segun densidad.
- Metadatos: `text-xs text-muted-foreground`.

Reglas:

- No escalar fuentes con viewport width.
- No usar letter spacing negativo.
- No usar textos hero-scale dentro de cards, sidebars, modales o tablas.
- Los textos largos deben truncarse o envolver de forma intencional.

### 3.4 Radio, Bordes y Elevacion

El radio base es `--radius: 0.5rem`.

Reglas:

- Cards y contenedores de herramienta: maximo visual equivalente a `rounded-lg` salvo componente existente.
- Botones y controles: usar variantes de `Button`.
- No anidar cards dentro de cards.
- No usar sombras fuertes; el borde debe ser el separador principal.
- Las secciones de pagina no deben ser cards flotantes. Usar bandas o layouts sin marco.

---

## 4. Layout De Pagina

### 4.1 Estructura Base

Las paginas de modulo deben seguir esta secuencia:

1. Encabezado del modulo.
2. Acciones principales.
3. Metric cards si aplican.
4. Tabs o filtros.
5. Tabla, formulario o contenido principal.

Usar clases globales existentes:

- `dashboard-page-heading`
- `dashboard-page-heading-row`
- `dashboard-page-heading-copy`
- `dashboard-page-heading-actions`
- `dashboard-toolbar`
- `dashboard-toolbar-search`
- `dashboard-toolbar-control*`
- `tabs-scroll-shell`
- `tabs-scroll-list`
- `table-scroll-shell`

### 4.2 Toolbars

La busqueda debe ir primero, ocupar el espacio flexible y mantenerse usable en mobile.

Patron obligatorio:

- Search: `dashboard-toolbar-search`
- Selects/filtros: `dashboard-toolbar-control`, `dashboard-toolbar-control-wide`, `dashboard-toolbar-control-xl` o `dashboard-toolbar-control-2xl`
- Menus: ancho limitado con `dashboard-toolbar-menu`

No crear toolbars ad hoc con anchos arbitrarios si una clase global existente resuelve el caso.

### 4.3 Tabs

Usar scroll horizontal controlado con:

- `tabs-scroll-shell`
- `tabs-scroll-list`

Reglas:

- Los labels de tabs deben ser cortos.
- No meter tabs dentro de cards decorativas.
- En mobile no deben romper linea si eso cambia la altura del header de forma brusca.

### 4.4 Grids De Metricas

Grid recomendado:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
  ...
</div>
```

Reglas:

- Usar `MetricCard` para KPIs.
- No crear metric cards nuevas por modulo.
- Mantener altura estable entre loading y loaded.
- Los valores monetarios deben formatearse de forma consistente.

---

## 5. Componentes Estandar

### 5.1 MetricCard

Archivo canonico: `src/components/shared/MetricCard.tsx`

Uso:

- Totales.
- Conteos.
- Ingresos.
- Estados activos/inactivos.
- Indicadores de salud o disponibilidad.

Reglas:

- Usar `icon` de `lucide-react`.
- Usar `underlineColor` para el estilo de dashboard actual.
- Usar `loading={true}` para skeletons.
- No pasar `value="Calculando..."` como loading visual.
- No mezclar `borderColor` y `underlineColor` salvo que exista una razon de compatibilidad.

Ejemplo recomendado:

```tsx
<MetricCard
  title="Ingreso Total"
  value={formattedAmount}
  icon={DollarSign}
  iconColor="text-orange-500"
  underlineColor="bg-orange-500"
  loading={isLoading}
/>
```

### 5.2 DataTable

Archivo canonico: `src/components/shared/DataTable.tsx`

Uso:

- Listados de ventas, servicios, terceros, pagos, notificaciones y auditoria.

Reglas:

- Definir columnas fuera del render cuando sea posible.
- Usar `sortable` solo cuando el orden local sea correcto para el usuario.
- Usar `fixedLayout` cuando columnas con anchos especificos eviten saltos.
- Usar `containerClassName` y `tableClassName` antes de crear variantes nuevas.
- El scroll horizontal debe vivir en contenedores controlados, no en toda la pagina.
- Las acciones de fila deben detener propagacion si la fila tambien tiene click.

### 5.3 Buttons

Archivo canonico: `src/components/ui/button.tsx`

Variantes permitidas:

- `default`: accion primaria.
- `outline`: accion secundaria visible.
- `secondary`: accion secundaria de bajo riesgo.
- `ghost`: acciones de tabla, toolbar o iconos discretos.
- `destructive`: eliminar, anular, resetear o accion irreversible.
- `link`: navegacion textual puntual.

Tamanos:

- `default`: formularios y acciones principales.
- `sm`: toolbar y acciones secundarias.
- `xs`: tablas densas.
- `icon`, `icon-sm`, `icon-xs`: acciones icon-only.

Reglas:

- Todo boton icon-only debe tener `aria-label` o tooltip.
- Usar iconos de `lucide-react`.
- No crear botones manuales con `div` clickeable.
- No usar texto dentro de un boton si un icono conocido comunica mejor la accion y hay tooltip.

### 5.4 Cards

Archivo canonico: `src/components/ui/card.tsx`

Uso correcto:

- KPIs.
- Modales/contenidos puntuales.
- Items repetidos.
- Paneles de herramientas muy acotados.

Uso prohibido:

- Envolver secciones enteras de pagina solo para crear marco.
- Cards dentro de cards.
- Cards como layout principal de landing.
- Cards decorativas sin informacion accionable.

### 5.5 Dialogs, Dropdowns y Menus

Reglas:

- Dialogos solo para tareas enfocadas: crear, editar, confirmar, filtrar avanzado.
- Todo dialogo debe tener titulo y descripcion accesible cuando aplique.
- Menus deben tener labels cortos y acciones ordenadas por frecuencia.
- Las acciones destructivas deben separarse visualmente o usar `destructive`.

### 5.6 Formularios

Reglas:

- Formularios grandes deben dividirse en secciones.
- Cada seccion debe tener responsabilidad clara: cliente, servicio, periodo, pago, notas.
- Los controladores deben manejar estado/orquestacion; las secciones deben ser presentacionales cuando sea posible.
- Validaciones deben mostrarse cerca del campo.
- No mezclar calculos de negocio complejos dentro del JSX.
- No crear formularios de mas de 300 lineas sin justificarlo en ADR o plan.

---

## 6. Estados De UI

### 6.1 Loading

Reglas:

- Metricas: usar `MetricCard loading`.
- Tablas: usar `DataTable loading` o skeleton especifico si hay layout complejo.
- Botones: mostrar spinner o disabled si la accion esta en curso.
- No mostrar `Calculando...` como valor final ni como unico loading state en widgets.

### 6.2 Empty

Componente canonico: `src/components/shared/EmptyState.tsx`

Reglas:

- Debe explicar que no hay datos.
- Puede incluir accion cuando el siguiente paso sea obvio.
- No confundir empty con error.

### 6.3 Error

Reglas:

- Mostrar mensaje claro y accion de reintento si aplica.
- No ocultar errores de lectura remota.
- Los errores de side-effects fire-and-forget deben registrarse con contexto estructurado.
- No usar `catch {}` vacio.

### 6.4 Optimistic UI

Reglas:

- Solo usar optimistic update cuando mejore claramente la UX.
- Debe existir rollback o invalidacion inmediata.
- Mutaciones exitosas deben invalidar queries relacionadas o emitir eventos tipados.

---

## 7. Data Ownership En UI

La UI debe respetar el contrato de arquitectura:

| Responsabilidad | Herramienta |
|---|---|
| Lecturas remotas | TanStack Query |
| Cache de servidor | TanStack Query |
| Estado UI local/global | Zustand |
| Escrituras optimistas | Zustand + invalidacion |
| Reglas de negocio | Use-cases |
| Supabase/RPC | Repositories/RPC adapters |
| Comunicacion entre modulos | StoreEventBus / eventos tipados |

Reglas:

- No hacer `useEffect + useState` para data fetching remoto nuevo.
- No usar `window.dispatchEvent` para comunicacion de negocio.
- No usar `localStorage` como bus de eventos.
- No llamar helpers Supabase directamente desde componentes salvo excepcion documentada.
- No duplicar conteos o metricas en stores si ya existen como read model/query.

---

## 8. Accesibilidad

Reglas obligatorias:

- Botones icon-only: `aria-label` o tooltip.
- Inputs: label visible o `aria-label` cuando el contexto sea suficiente.
- Dialogos: titulo accesible.
- Foco visible: no remover `focus-visible`.
- Contraste: texto secundario solo para informacion secundaria.
- Tablas: headers claros, acciones identificables y estados vacios legibles.
- Color: no debe ser la unica senal de estado.

---

## 9. Responsive

Reglas:

- Mobile primero: controles se apilan antes de comprimirse.
- Desktop: aprovechar grids para escaneo, no para decorar.
- Tablas: scroll horizontal controlado con ancho minimo estable.
- Toolbars: busqueda flexible + controles de ancho estable.
- Textos largos: truncar, envolver o mover a segunda linea.
- No permitir superposicion de texto, iconos o acciones.

---

## 10. Do / Don't

### Do

- Usar `MetricCard`, `DataTable`, `Button`, `Card`, `EmptyState` y `LoadingSpinner`.
- Usar tokens de Tailwind basados en `globals.css`.
- Usar Lucide para iconografia.
- Usar skeleton/loading real para lecturas remotas.
- Mantener componentes pequenos y orientados a una responsabilidad.
- Crear ADR si se cambia un patron central.

### Don't

- No crear cards nuevas para cada modulo.
- No crear botones custom con clases manuales si `Button` cubre el caso.
- No usar `Calculando...` como reemplazo de skeleton/loading.
- No crear formularios monoliticos.
- No mezclar fetch remoto nuevo con `useState + useEffect`.
- No usar eventos DOM para sincronizacion de negocio.
- No agregar decoracion visual sin informacion o accion.
- No dejar componentes zombie, wrappers sin valor o variantes duplicadas.

---

## 11. Checklist Para PRs De UI

Antes de abrir o cerrar un PR de UI:

- [ ] La pantalla usa tokens globales, no colores hardcodeados innecesarios.
- [ ] Los KPIs usan `MetricCard`.
- [ ] Las tablas usan `DataTable` o justifican una excepcion.
- [ ] Hay estados loading, empty y error.
- [ ] No hay texto `Calculando...` como loading permanente en widgets.
- [ ] Los botones usan `Button` y los icon-only tienen nombre accesible.
- [ ] Los iconos vienen de `lucide-react`.
- [ ] No hay cards anidadas.
- [ ] No hay nuevas lecturas remotas con `useState + useEffect`.
- [ ] Las mutaciones invalidan queries o emiten eventos tipados.
- [ ] La vista no rompe en mobile.
- [ ] Los textos largos no se superponen.
- [ ] No se agrego codigo legacy/deprecated sin plan de retiro.

---

## 12. Archivos Canonicos

| Area | Archivo |
|---|---|
| Tokens globales y helpers CSS | `src/app/globals.css` |
| Metricas | `src/components/shared/MetricCard.tsx` |
| Tablas | `src/components/shared/DataTable.tsx` |
| Empty state | `src/components/shared/EmptyState.tsx` |
| Loading | `src/components/shared/LoadingSpinner.tsx` |
| Botones | `src/components/ui/button.tsx` |
| Cards | `src/components/ui/card.tsx` |
| Data ownership | `docs/adr/0002-react-query-zustand-ownership.md` |
| Eventos tipados | `docs/adr/0004-typed-client-events.md` |
| Modulos profundos | `docs/adr/0005-modular-monolith-deep-modules.md` |

---

## 13. Gobierno Del Design System

1. Todo componente compartido nuevo debe resolver un patron repetido real.
2. Toda variante nueva debe documentarse aqui si queda disponible para mas de un modulo.
3. Si una decision cambia ownership de datos, eventos o componentes base, debe registrarse en ADR.
4. Los componentes legacy deben eliminarse o marcarse con plan de retiro.
5. Este documento debe revisarse junto con el roadmap de arquitectura al cerrar fases grandes.

---

## 14. Regla De Cierre

Una pantalla se considera alineada al design system cuando:

- Puede entenderse y operarse rapidamente.
- Usa los componentes canonicos.
- Maneja todos los estados de datos.
- Mantiene responsabilidad clara entre UI, estado, use-cases y repositorios.
- No introduce patrones visuales o tecnicos paralelos sin documentarlos.
