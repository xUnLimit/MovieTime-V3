# MovieTime PTY - Design System

**Estado:** Vigente · **Version:** 2.0 · **Fecha:** Septiembre 2026
**Alcance:** toda la UI de producto. Es la fuente canonica de decisiones visuales; `AGENTS.md` lo hace obligatorio y `npm run design:check` lo hace cumplir.

Direccion: **Vercel / Geist**. Limpio, sobrio, denso pero respirable. Es una herramienta operativa para dos personas que la usan a diario en escritorio y celular (PWA): lectura rapida, comparacion y accion repetida. Nada decorativo.

---

## 1. Identidad (intocable)

- **Nombre:** MovieTime PTY.
- **Logo:** la "M" de `public/logo.svg`. Se usa siempre con el componente `Logo` (SVG con `currentColor`), nunca como `<img>`.
- **Color de marca:** violeta (oklch, hue 295). Es el acento: boton primario, foco, navegacion activa, serie 1 de graficos.
- **Tema:** claro y oscuro son de primera clase y se validan ambos. Por defecto oscuro; el tema guardado se aplica antes del primer pintado (sin destello). El sistema respeta `prefers-color-scheme` cuando el usuario elige "sistema".

## 2. Principios

1. **Operar primero.** La primera pantalla muestra datos o acciones utiles, nunca marketing.
2. **Un estandar para todo.** Un componente por patron; una escala tipografica; una altura de control. Si hace falta algo nuevo, se agrega aqui primero.
3. **El estado nunca se comunica solo con color.** Siempre punto o icono + texto (`StatusBadge`).
4. **Color solo con significado.** Los iconos y numeros son neutros salvo que el estado importe.
5. **Igual de bueno en celular.** Controles tactiles de 40px, sin scroll horizontal de pagina.
6. **Sin decoracion.** Nada de degradados de fondo, brillos, sombras de color, glassmorphism ni ilustraciones de relleno.

## 3. Color

Todo color sale de tokens en `src/app/globals.css`. **Prohibido** usar paleta cruda (`text-red-500`, `bg-green-100`...) o hexadecimales en clases; el guardian lo bloquea.

| Rol | Tokens | Uso |
|---|---|---|
| Superficies | `background`, `card`, `popover`, `muted`, `accent`, `secondary` | Pagina gris muy claro; tarjetas blancas con borde hairline. |
| Texto | `foreground`, `muted-foreground` | Principal y secundario. |
| Bordes | `border`, `input`, `ring` | Hairline. El borde es el separador principal. |
| Marca | `primary`, `primary-foreground` | Accion principal, foco, activo. |
| Exito | `success`, `success-subtle`, `success-border`, `success-foreground` | Activo, al dia, ganancia. |
| Advertencia | `warning`, `warning-subtle`, `warning-border`, `warning-foreground` | Proximo a vencer, reposo. |
| Peligro | `danger`, `danger-subtle`, `danger-border`, `danger-foreground` (`destructive`) | Vencido, error, accion irreversible. |
| Informacion | `info`, `info-subtle`, `info-border`, `info-foreground` | Datos esperados, promesas de pago. |
| Graficos | `chart-1..5` | Serie 1 = violeta; gastos = `danger`; ganancia = `success`. |

Reglas:
- Texto de estado: `text-{tono}`. Fondo tenue: `bg-{tono}-subtle`. Borde: `border-{tono}-border`. Solido: `bg-{tono}` + `text-{tono}-foreground`.
- No hay variantes `dark:` para colores semanticos: los tokens ya cambian con el tema.
- Contraste minimo AA (4.5:1 cuerpo, 3:1 texto grande) en ambos temas.
- En codigo, el tono se expresa con el tipo `Tone` (`src/components/shared/tone.ts`), nunca con clases sueltas.

## 4. Tipografia

Fuente: **Geist Sans** (y **Geist Mono** para codigo) via `next/font/google`. Cifras con `tabular-nums` (clase `tabular`) en montos, fechas y conteos. El tamano base del navegador se respeta: la raiz esta al 100%.

**Escala unica (4 tamanos, 3 pesos):**

| Rol | Tamano | Clase | Peso |
|---|---|---|---|
| Titulo de pagina y cifra de KPI | 20px | `text-xl` | semibold |
| Titulo de dialogo y seccion grande | 16px | `text-base` | semibold |
| Cuerpo (tablas, formularios, botones, menus, sidebar) y titulo de panel | 14px | `text-sm` | normal / medium / semibold |
| Secundario (descripciones, fechas, leyendas, ejes, metadatos) | 12px | `text-xs` | normal, `text-muted-foreground` |

- Pesos permitidos: `font-normal`, `font-medium` (etiquetas, botones), `font-semibold` (titulos).
- Prohibido: `text-[Npx]`, `text-lg`, `text-2xl` o mayor, `font-bold` y otros pesos. El CSS colapsa los escalones sobrantes al mas cercano como red de seguridad; el guardian los bloquea en el codigo.
- Inputs mantienen 16px en pantallas tactiles para evitar el zoom automatico de iOS.
- Texto de graficos (recharts): 12px.

## 5. Forma, altura y elevacion

- **Altura de control: 32px** (botones, campos, selectores, opciones de menu, paginadores). En pantallas tactiles (`pointer-coarse`) sube a 40px. Compacto 28px solo para acciones dentro de tablas densas; 24px solo en casos extremos.
- **Radios:** controles 6px (`rounded-md`), tarjetas 12px (`rounded-xl`), dialogos 12px, badges pildora.
- **Elevacion:** se declara una sola vez. Tarjetas = borde hairline sin sombra. Solo popovers, menus y dialogos llevan sombra suave. Nunca borde + sombra difusa juntos, ni sombras de color.
- **Densidad media:** filas de tabla 49px (`h-[49px]`, como Ventas, celda `py-1`), cabecera 36px, relleno de tarjeta 20px, margen de contenido 20px.
- **Bordes de color:** prohibido `border-left` de color > 1px en tarjetas, listas o alertas.

## 6. Layout

- **Shell:** barra lateral de 224px (56px colapsada, Ctrl/Cmd+B; drawer de 272px en movil). Fila de 32px, activo con fondo gris e icono violeta, separadores entre secciones, tooltip al colapsar, insignia de Chats con contador. La ruta activa incluye sus subrutas.
- **Pagina:** `PageHeader` (titulo 20px, migas, acciones) + KPIs + contenido. Un solo boton primario por vista.
- **Dashboard:** en `lg+` ocupa exactamente el alto disponible (sin scroll de pagina): filas `auto / auto / auto / 1fr`, graficos que llenan su panel (`Panel fill`). Por debajo del alto minimo (840px) hace scroll.
- **Tablas:** un solo molde y las mismas medidas en toda la app; la referencia es la tabla de Ventas. Sin scroll horizontal ni vertical. Las columnas secundarias se ocultan segun el ancho de la propia tabla (`hideBelow`, container queries; `hideBelowClass()` en tablas propias) y las filas por pagina se ajustan al alto disponible (`autoPageSize` o `ServerTableCard`). Medidas fijas (verificadas en navegador, ventana 1920x951): cabecera de pagina 52px, KPIs 80px, pestañas 36px, tarjeta de tabla desde y=228, buscador 32px, cabecera de tabla 36px, **fila 49px** (`h-[49px]`, nunca se mide de los datos), pie de paginacion 45px (`py-2`), **10 filas** cuando caben (minimo 5); una tabla llena mide 666px. Margenes laterales: primera columna `pl-4` y ultima `pr-4` (los aplica `TableCard`), celdas `px-3`. Las tablas con celdas propias no fijan `px`, `py`, `h-*` ni `min-w-*` en cabeceras o celdas. En movil la pagina hace scroll natural.
- **Contenido de celda:** el dato principal va arriba (`font-medium`, `truncate`) y el secundario debajo, en otra linea, `text-xs text-muted-foreground` y `truncate` (envoltorio `leading-tight`). Aplica a servicio + correo, categoria + servicio, metodo de pago + detalle/alias. Nunca en la misma linea separado por espacio. Las fechas largas pueden ocupar dos lineas (caben en 49px). **Montos:** simbolo de moneda en `text-success` y cifra en `text-foreground`, misma linea (`whitespace-nowrap`), `font-medium`. Ninguna columna se oculta para evitar el scroll: se ajusta el contenido.
- **Scrollbars:** finos, redondeados y discretos en toda la app (regla global en `globals.css`, colores `--scrollbar-thumb*`). No se personalizan por componente; solo cambian los tokens. Las barras de pestañas se ocultan a proposito.

## 7. Componentes canonicos

| Necesidad | Componente | Archivo |
|---|---|---|
| Encabezado de pagina | `PageHeader` | `src/components/shared/PageHeader.tsx` |
| KPIs | `MetricCard` + `MetricGrid` (`cards` o `strip`) | `shared/MetricCard.tsx`, `shared/MetricGrid.tsx` |
| Widget de grafico o lista | `Panel` (`fill` para graficos), `PagerControls` | `shared/Panel.tsx`, `shared/PagerControls.tsx` |
| Estado | `StatusBadge` + `Tone` | `shared/StatusBadge.tsx`, `shared/tone.ts` |
| Vencimiento / disponibilidad | `getEstadoVencimiento`, `getDisponiblesColorClass` | `shared/vencimiento-status.ts`, `shared/disponibilidad-status.ts` |
| Dinero | `Money`, `formatearMoneda` | `shared/Money.tsx`, `platform/utils/calculations.ts` |
| Tablas | `TableCard` + `TableToolbar`/`TableSearch`/`FilterMenu` + `DataTable bare` (o `ServerTableCard` si pagina el servidor) | `shared/TableCard.tsx`, `shared/TableToolbar.tsx`, `shared/DataTable.tsx`, `shared/ServerTableCard.tsx` |
| Vacio / carga / error | `EmptyState`, `Skeleton`, `LoadingSpinner`, `ModuleErrorBoundary` | `shared/*` |
| Marca | `Logo` | `shared/Logo.tsx` |
| Simulacion de celular (vista previa de mensajes) | `PhoneMockup`: tamano fijo 300x600, el contenido hace scroll adentro; el marco nunca cambia de tamano | `editor-mensajes/PhoneMockup.tsx` |
| Lienzo de flujos (editor de recorridos) | `FlowCanvas` (React Flow) con nodos `FlowNodeCard`; vista alternativa `NodeList` + `NodeEditor`. Las variables `--xy-*` de la libreria se enlazan a tokens en `globals.css`; las posiciones solo viven en la sesion. En pantallas angostas (< 1024px) solo se muestra la lista | `bot/flow/*` |
| Primitivas | shadcn (Button, Input, Select, Tabs, Dialog, Dropdown, Popover, Tooltip, Badge, Card, Switch, Checkbox, Kbd...) | `src/components/ui/*` |
| Iconos | `lucide-react` (16px, trazo estandar) | - |
| Avisos | `sonner` con tonos semanticos | `ui/sonner.tsx` |

Reglas de uso:
- **Tabs:** variante `default` (linea inferior) para secciones; `pills` para alternar vistas dentro de una tarjeta. No se agregan clases personalizadas a `TabsList`/`TabsTrigger` (ni `h-auto`/`flex-wrap`: la barra mide siempre 36px).
- **Botones:** `default` accion principal; `outline` secundaria; `ghost` acciones discretas/tabla; `destructive` irreversible. Icon-only siempre con `aria-label` o `Tooltip`.
- **Badges de estado:** `StatusBadge` con punto + texto. Nunca pildoras a mano con clases de color.
- **Formularios:** secciones con responsabilidad clara, error junto al campo (`text-danger`), etiqueta visible.
- **Dialogos:** solo para tareas enfocadas; titulo y descripcion accesibles; acciones destructivas con `destructive`.
- **Un `Panel` no anida tarjetas.** No hay cards dentro de cards.
- **Ajustes y configuracion** viven en su propia pagina (`/configuracion`), nunca en un dialogo. Los dialogos son solo para tareas enfocadas y cortas.
- **Editores con vista previa:** un solo formulario sin pestanas para lo esencial, lo opcional plegado (`aria-expanded`), pie de guardado fijo dentro de la tarjeta y vista previa de tamano fijo (no debe redimensionarse al escribir). Los datos insertables son botones visibles, no un menu escondido.

## 8. Estados

Todo dato remoto tiene carga, vacio y error.
- **Carga:** `MetricCard loading`, `DataTable loading` o `Skeleton` con la misma forma y altura que el contenido. Nunca "Calculando..." como valor.
- **Vacio:** `EmptyState` con mensaje y, si el siguiente paso es obvio, una accion.
- **Error:** mensaje claro + "Reintentar"; `ModuleErrorBoundary` aisla fallos de modulo. Sin `catch {}` vacios.

## 9. Movimiento

Discreto y funcional: 150-200ms `ease-out` en hover, aperturas y cambios de vista; retroalimentacion de pulsacion (`active:scale-[0.98]`). Se respeta `prefers-reduced-motion`. Sin animaciones decorativas.

**Acceso (`/login`)** es la unica pantalla con una secuencia propia, porque marca el paso entre "fuera" y "dentro" y comunica estado (`LoginScreen`, clases `login-*` en `globals.css`):
- Entrada escalonada de 420ms (marca y titulo, formulario, pie con 70ms de diferencia), solo desplazamiento (`transform`): nunca parte de `opacity: 0`, para que el primer cuadro ya pinte el contenido (Lighthouse devolvio NO_FCP cuando la entrada era invisible).
- Al iniciar sesion: el boton muestra un check y "Bienvenido", el formulario se desvanece, la marca se rellena de `primary` y la pantalla se apaga (480ms en total, `LOGIN_ENTER_MS`) antes de navegar al Dashboard.
- Error: mensaje visible junto al formulario (`role="alert"`) y un temblor de 320ms de la tarjeta; el foco vuelve al campo.
- Con `prefers-reduced-motion: reduce` no hay animaciones ni espera: se navega de inmediato.
- No se agregan mas secuencias como esta a otras pantallas; el resto de la app sigue la regla de 150-200ms.

## 10. Accesibilidad

- Foco visible siempre (anillo violeta). No se quita `focus-visible`.
- `aria-label` en icon-only; titulos accesibles en dialogos; `aria-busy` en cargas; `role="alert"` en errores.
- El color no es la unica senal de estado.
- Objetivo: axe sin impactos serios/criticos y Lighthouse accesibilidad >= 0.95.

## 11. Herramientas de revision (solo desarrollo)

Rutas que devuelven 404 en produccion y no requieren sesion:
- `/design-lab`: todos los componentes en claro y oscuro.
- `/design-lab/shell`: el shell real con sesion sintetica.
- `/design-lab/dashboard`: el Dashboard real con datos sinteticos (`src/app/design-lab/demo-dashboard-data.ts`).

Toda pantalla nueva debe poder revisarse aqui antes de darse por terminada.

## 12. Cumplimiento

- `npm run design:check` (`scripts/check-design-tokens.mjs`) falla ante: paleta cruda, hexadecimales en clases, `text-[Npx]`, `text-lg`/`text-2xl+`, pesos fuera de normal/medium/semibold. Corre en `quality:fast` y `quality:full`.
- Toda variante nueva disponible para mas de un modulo se documenta aqui.
- Los cambios a tokens o a la escala se hacen en `globals.css` y se reflejan en este archivo en el mismo cambio.
- Los componentes heredados se eliminan o llevan plan de retiro; no se copian como patron.

## 13. Checklist para PRs de UI

- [ ] Solo tokens; `npm run design:check` en verde.
- [ ] Tamanos 12/14/16/20 y pesos normal/medium/semibold.
- [ ] Controles de 32px (40px tactil); icon-only con nombre accesible.
- [ ] `PageHeader`, `MetricGrid`/`MetricCard`, `Panel`, `StatusBadge`, `DataTable` cuando aplican.
- [ ] Tablas: medidas de la seccion 6 (fila 49px, 10 filas, sin scroll horizontal) comparadas con Ventas en el navegador al cambiar de pagina y de pestaña; dato secundario debajo; montos con simbolo verde.
- [ ] Carga, vacio y error resueltos con componentes compartidos.
- [ ] Claro y oscuro revisados; movil (390px) sin desbordes.
- [ ] Sin cards anidadas ni decoracion.
- [ ] Datos remotos por React Query; sin `useEffect + useState` para fetch nuevo.
