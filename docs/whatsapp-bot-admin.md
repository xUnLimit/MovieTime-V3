# Bot de WhatsApp administrable

Especificacion de la pantalla **Bot** y del motor que la respalda. Reemplaza los textos, tiempos y el
interruptor que hoy viven en el codigo (`bot-menu.ts`) y en la variable `WHATSAPP_BOT_ENABLED`.
Las reglas de `AGENTS.md` aplican en su totalidad. El contrato de tipos esta en `src/types/bot.ts`.

## 1. Objetivo

El administrador debe poder **ver, entender, cambiar y probar** el bot sin tocar codigo:
encenderlo y apagarlo al instante, editar el flujo de botones, editar cada mensaje, ajustar tiempos y limites,
probar el recorrido en un simulador, ver que hizo el bot con cada cliente y volver a una version anterior.

## 2. Principios

- **Nada de texto o numero de negocio hardcodeado** en el runtime. El codigo solo tiene *valores por defecto*
  (`defaultDefinition()`), usados al sembrar y al "Restablecer"; lo vigente sale de la base de datos.
- **Publicar es atomico y versionado.** Se edita un borrador en el navegador; "Publicar" valida y guarda una
  version nueva; el bot usa siempre la ultima publicada. Se puede restaurar cualquier version anterior.
- **Interruptor independiente** de las versiones (apagar no exige publicar) y a prueba de fallos: sin fila de
  configuracion, sin version publicada o con error al leerla, el bot **no responde**.
- **Lo seguro no es configurable:** solo clientes registrados reciben respuesta, el codigo nunca se guarda en
  claro en el chat ni en eventos, solo se abre el enlace exacto `/account/travel/verify`, el buzon es de solo
  lectura, la entrega de cada codigo es unica (`netflix_code_claims`) y el cruce por perfil en viaje es obligatorio.
- **Solo administradores** editan; la autorizacion se hace en servidor (RLS y RPC), nunca solo en la UI.
- Los textos son texto plano de WhatsApp (se permite `*negrita*`). Sin HTML. Marcadores `{{nombre}}` de una lista
  cerrada por mensaje.

## 3. Modelo de datos (migraciones forward-only, expand/contract)

- `whatsapp_bot_config` (una fila `id='global'`): `enabled boolean not null default false`,
  `published_version integer null`, `updated_at`, `updated_by uuid`.
- `whatsapp_bot_versions`: `version integer generated always as identity primary key`,
  `definition jsonb not null` (limite 256 KB, `jsonb_typeof = 'object'`), `note text`, `created_by uuid`,
  `created_at timestamptz default now()`. Inmutable (sin update/delete para usuarios).
- `whatsapp_bot_events`: `id uuid`, `created_at`, `wa_id text`, `cliente_id uuid null`, `type text`,
  `node_id text null`, `option_id text null`, `detail jsonb` (sin secretos). Indices por `created_at desc`,
  `(wa_id, created_at desc)` y `type`. Retencion de 90 dias (purga oportunista al insertar o `pg_cron` si ya se usa).
- RPC `publish_whatsapp_bot_version(p_definition jsonb, p_note text) returns integer` (SECURITY DEFINER,
  `search_path=''`, exige administrador): inserta la version y fija `published_version` en una transaccion.
  RPC `set_whatsapp_bot_enabled(p_enabled boolean) returns boolean` (idem).
- RLS activa en las tres tablas. Administradores: leen todo; escriben solo mediante las RPC. El webhook usa
  service role. `revoke` a `anon`. Seguir el patron de `20261001020000_revoke_anon_table_privileges.sql` y de
  las politicas existentes (descubrir como se identifica a un administrador en las migraciones actuales).
- Siembra: una version 1 con `defaultDefinition()` y `enabled` en `false`, creada por la propia migracion.
- Cambios de configuracion (publicar, restaurar, encender/apagar) se registran en `log-actividad` siguiendo la
  convencion existente (`detalles` visible, `metadata` estructurada).

## 4. Definicion del bot (`BotDefinition`)

Un grafo de **nodos**; cada nodo es un mensaje y sus opciones llevan a otros nodos.

| kind | Muestra | Opciones |
|---|---|---|
| `buttons` | texto + 1 a 3 botones (titulo max 20) | cada una apunta a un nodo |
| `list` | texto + lista (boton max 20, filas max 10, titulo max 24, descripcion max 72) | idem |
| `text` | texto final | ninguna |
| `action` | nada propio: ejecuta una accion integrada | ninguna |

Acciones integradas (el codigo sabe *como* hacerlas; el administrador decide *donde* conectarlas y *que dicen*):
`netflix_login_code`, `netflix_travel_code`, `handoff` (pasar a una persona).

Flujo por defecto (equivale al actual): `menu` (buttons: Codigo de Netflix -> `netflix`, Hablar con soporte ->
`soporte`) · `netflix` (buttons: Iniciar sesion -> `login`, Estoy de viaje -> `viaje`) · `login` (action) ·
`viaje` (action) · `soporte` (action handoff).

Mensajes del sistema (`messages`, claves en `BotMessageKey`) con sus marcadores:
`login_code_sent{{codigo}}{{minutos}}` · `travel_code_sent{{codigo}}{{perfil}}{{minutos}}` ·
`travel_link_sent{{enlace}}{{minutos}}` · `login_not_found{{minutos}}` · `travel_not_found{{perfil}}{{minutos}}` ·
`already_sent` · `profile_missing` · `no_netflix_account` · `rate_limited{{minutos}}` · `mailbox_unavailable` ·
`handoff_ack` · `option_unavailable` · `account_picker_body` · `account_picker_button`.
Marcadores **obligatorios** (no se puede publicar sin ellos): `{{codigo}}` en `login_code_sent`/`travel_code_sent`,
`{{enlace}}` en `travel_link_sent`.

Parametros (`BotParams`) y palabras clave: ver rangos en `src/types/bot.ts`.

Validacion (`validateDefinition`, devuelve `BotIssue[]`): ids con formato y unicos, `entryNodeId` existe, toda
opcion apunta a un nodo existente, limites de WhatsApp por tipo, nodos `action` con accion valida y sin opciones,
acciones alcanzables, marcadores permitidos y obligatorios, sin nodos inalcanzables desde la entrada (error; mensaje: «Ningún botón lleva a ...»), sin ciclos sin salida
(error; solo cuenta un ciclo inescapable: si algun camino llega a un nodo `text` o `action` no hay problema), parametros en rango, palabras clave sin duplicados. Cualquier `error` bloquea publicar.

## 5. Runtime (webhook)

- `bot-config-store` (service role) lee `enabled` y la version publicada (validada con el esquema; si no valida,
  el bot calla y registra un evento `error`).
- Ids de respuesta interactiva: `BOT:<nodeId>:<optionId>`; la lista de cuentas usa
  `BOT:ACC:<LOGIN|TRAVEL>:<serviceId>`. Un id cuyo nodo/opcion ya no existe responde `option_unavailable` y
  reofrece el menu.
- El menu inicial se ofrece segun `keywords` y `menuIdleHours`/`operatorQuietMinutes`.
- Las acciones usan `params` y `messages` de la version publicada; el resto del comportamiento de seguridad es fijo.
- Cada decision relevante inserta un `BotEvent` (sin codigos ni enlaces).
- El interruptor `enabled` de la base de datos **sustituye** a `WHATSAPP_BOT_ENABLED` (la variable ya no existe en el codigo; hay que borrarla de Vercel y de `.env.local`).

## 6. Pantalla Automatizaciones (`/automatizaciones`, entrada "Automatizaciones" en el menu lateral)

Sigue `DESIGN.md` (tokens, `PageHeader`, `MetricGrid`, `Panel`, `StatusBadge`, `DataTable`; tabla de actividad con
las medidas de Ventas: fila 49px, 10 filas, sin scroll horizontal). Solo administradores.

1. **Resumen**: interruptor grande con confirmacion al apagar/encender, version publicada, metricas de 24 h
   (eventos, codigos entregados, bloqueos), lista de comprobaciones (WhatsApp configurado, buzon configurado,
   ultima actividad) y boton **Probar buzon** (conexion de solo lectura; muestra cuantos correos de Netflix hay
   recientes, nunca su contenido).
2. **Flujo**: lista de nodos a la izquierda, editor del nodo seleccionado a la derecha (nombre, tipo, texto,
   opciones con titulo/destino, accion), alta/baja/reordenado de nodos y opciones, contadores de caracteres con
   los limites de WhatsApp, diagrama del flujo generado automaticamente (SVG, solo lectura, nodos clicables) y
   **simulador** en un telefono (`PhoneMockup`) donde se pulsan los botones y se ve el recorrido con datos de ejemplo.
3. **Respuestas**: estudio de tres columnas (lista con buscador y filtros Todos / Editados / Con error, editor y vista
   previa del cliente). Las respuestas del bot y los textos de compras se editan igual: lo valido se aplica al borrador
   al escribir; el motivo de un error se dice junto al campo, los datos obligatorios van marcados, "Restablecer" esta en
   el encabezado y "Anterior / Siguiente" recorre la lista.
4. **Ajustes**: tarjetas por tema (menu y atencion, codigos de Netflix, limites de uso) con unidad, rango, valor
   predeterminado y marca "Cambiado" frente a lo publicado; palabras clave, conexiones y enlace a Configuracion.
5. **Actividad**: tabla paginada de eventos con filtros (tipo, cliente/telefono, fechas) y enlace al chat.
6. **Versiones**: historial con nota, autor y fecha; ver, cargar en el borrador y publicar.

Barra de publicacion fija: estado "sin cambios / N cambios sin publicar", lista de problemas de validacion,
**Descartar**, **Restablecer valores por defecto** y **Publicar** (pide una nota; deshabilitado con errores).
Avisar antes de salir con cambios sin publicar. Estados vacios, de carga y de error en cada pestaña.

## 7. Capas y archivos

| Capa | Archivos |
|---|---|
| Tipos | `src/types/bot.ts` (contrato, ya creado) |
| Logica pura | `src/modules/bot-config/`: `schema.ts` (Zod), `catalog.ts` (acciones, mensajes, marcadores, limites), `defaults.ts`, `validate.ts`, `render.ts`, `payload.ts` (nodo -> `OutboundPayload`, ids), `graph.ts` (diagrama), `simulate.ts`, `index.ts` |
| Tiendas | `src/modules/messaging/bot-config-store.ts` (service role, runtime), `bot-events-store.ts` |
| Repositorio admin | `src/platform/supabase/bot-config-repository.ts` (RLS, RPC tipadas) |
| Casos de uso | `src/application/use-cases/bot-admin-use-cases.ts`, `whatsapp-bot-use-case.ts` (runtime) |
| API | `src/app/api/whatsapp/bot/mailbox-check/route.ts` (admin, `no-store`, `requestId`) |
| Hook | `src/hooks/use-bot-admin.ts` implementa `BotAdminApi` |
| UI | `src/app/(dashboard)/automatizaciones/page.tsx`, `src/components/bot/**` (pestanas Recorrido, Respuestas, Ajustes, Actividad, Versiones) |

## 8. Pruebas y calidad

Unitarias de cada funcion pura y rama de casos de uso; repositorio con cliente falso; pgTAP de tablas, RLS y RPC
(anon sin acceso, no administrador rechazado, version inmutable, publicar atomico); pruebas de componentes de la
UI; E2E o accesibilidad de `/automatizaciones` si el patron del repo lo permite. Cobertura 80/70 en lo cambiado y 90/80 en
autorizacion y migraciones. `npm run quality:full` en verde.

## 9. Fases

0. (hecha) Contrato `src/types/bot.ts` y este documento.
1. Comportamiento seguro del bot (reclamo unico, cruce por perfil, ventanas) — agente A.
2. Nucleo puro `bot-config` — agente B. UI contra el contrato — agente C. En paralelo.
3. Datos: migracion, repositorios, casos de uso admin, hook, API — agente D (despues de A por `database.types.ts`).
4. (hecha) Motor: el runtime lee la definicion publicada, registra eventos y retira `WHATSAPP_BOT_ENABLED` — agente E.
5. Integracion, revision y `quality:full` (ver seccion 11).

## 10. API publica de `@/modules/bot-config` (`index.ts`)

Todo es puro (sin red ni base de datos). Los tipos vienen de `@/types/bot`. Firmas exactas:

```ts
// Valores por defecto y validacion
defaultDefinition(): BotDefinition;
parseDefinition(input: unknown): { success: true; definition: BotDefinition } | { success: false; issues: BotIssue[] };
validateDefinition(definition: BotDefinition): BotIssue[];            // errores y avisos
hasBlockingIssues(issues: readonly BotIssue[]): boolean;

// Catalogos (la UI los usa para pintar etiquetas, limites y marcadores)
NODE_LIMITS: { bodyMax: 1024; buttonsMax: 3; buttonTitleMax: 20; listRowsMax: 10; listTitleMax: 24;
               listDescriptionMax: 72; listButtonMax: 20; nodesMax: 40; keywordsMax: 30 };
ACTION_CATALOG: Record<BotActionKey, { label: string; description: string }>;
MESSAGE_CATALOG: Record<BotMessageKey, { label: string; description: string; group: 'netflix' | 'sistema';
                 variables: readonly string[]; required: readonly string[]; maxLength: number; defaultText: string }>;
PARAM_CATALOG: Record<keyof BotParams, { label: string; description: string; unit: string; min: number; max: number; defaultValue: number }>;
VARIABLE_CATALOG: Record<string, { label: string; example: string }>;  // codigo, enlace, perfil, minutos, ...

// Plantillas
renderTemplate(template: string, values: Record<string, string>): string;       // reemplaza {{x}}; deja intactos los desconocidos
templateVariables(template: string): string[];

// Menu y palabras clave
normalizeText(text: string): string;                                   // minusculas, sin acentos, espacios colapsados
matchesKeyword(text: string | null, keywords: readonly string[]): boolean;
shouldOfferMenu(input: { text: string | null; lastActivityAt: string | null; operatorRepliedRecently: boolean;
                         now: Date; params: BotParams; keywords: readonly string[] }): boolean;

// Nodo -> mensaje de WhatsApp (estructura compatible con OutboundPayload) e ids de boton
buildNodeMessage(node: BotNode): BotOutboundMessage;                   // text | buttons | list
optionReplyId(nodeId: string, optionId: string): string;               // "BOT:<nodeId>:<optionId>"
parseOptionReplyId(id: string): { nodeId: string; optionId: string } | null;
resolveOption(definition: BotDefinition, nodeId: string, optionId: string): { node: BotNode; option: BotOption; target: BotNode } | null;

// Edicion segura del borrador (la UI las llama dentro de updateDraft)
slugify(text: string): string;
uniqueId(base: string, taken: readonly string[]): string;
addNode(def: BotDefinition, kind: BotNodeKind, name: string): BotDefinition;
removeNode(def: BotDefinition, nodeId: string): BotDefinition;         // limpia opciones que apuntaban a el
updateNode(def: BotDefinition, nodeId: string, patch: Partial<Omit<BotNode, 'id'>>): BotDefinition;
addOption(def: BotDefinition, nodeId: string): BotDefinition;
removeOption(def: BotDefinition, nodeId: string, optionId: string): BotDefinition;
moveOption(def: BotDefinition, nodeId: string, from: number, to: number): BotDefinition;
setMessage(def: BotDefinition, key: BotMessageKey, text: string): BotDefinition;
setParam(def: BotDefinition, key: keyof BotParams, value: number): BotDefinition;
setKeywords(def: BotDefinition, keywords: string[]): BotDefinition;
diffDefinitions(a: BotDefinition, b: BotDefinition): string[];         // lista corta legible de cambios

// Diagrama
buildFlowGraph(def: BotDefinition): { nodes: { id: string; name: string; kind: BotNodeKind; x: number; y: number;
  width: number; height: number; reachable: boolean }[]; edges: { from: string; to: string; label: string }[];
  width: number; height: number };

// Simulador (turnos para el telefono de la UI; las acciones usan datos de ejemplo)
startSimulation(def: BotDefinition): SimulationState;
stepSimulation(def: BotDefinition, state: SimulationState, optionId: string): SimulationState;
type SimulationTurn = { from: 'bot' | 'customer'; text: string; buttons?: { id: string; title: string }[];
  list?: { buttonLabel: string; rows: { id: string; title: string; description?: string }[] } };
type SimulationState = { turns: SimulationTurn[]; currentNodeId: string | null; finished: boolean };
type BotOutboundMessage =
  | { kind: 'text'; text: string }
  | { kind: 'buttons'; body: string; buttons: { id: string; title: string }[] }
  | { kind: 'list'; body: string; buttonLabel: string; rows: { id: string; title: string; description?: string }[] };
```

Quedan internas al modulo (sin consumidor fuera de el): `matchesKeyword`, `optionReplyId`, `slugify`, `uniqueId`, `defaultMessages`, `botDefinitionSchema` y los tipos `BotOutboundMessage`, `FlowGraph*`, `Simulation*`. Se exportan de nuevo desde `index.ts` solo cuando aparezca un consumidor real (`npm run dead-code`).

La UI importa **solo** de `@/modules/bot-config`, `@/types/bot` y del hook `@/hooks/use-bot-admin`.

## 11. Motor en produccion (fase 4)

Decisiones del runtime (`webhook/route.ts`, `webhook/bot-runtime.ts`, `whatsapp-bot-use-case.ts`):

- **Una lectura por entrega.** El webhook carga la configuracion con `createBotConfigStore().load()` la primera vez que un mensaje nuevo llega al bot
  y reutiliza el resultado para el resto de los mensajes de esa entrega. `load()` tambien exige que la definicion pase `validateDefinition`
  (sin errores bloqueantes); si no, el motivo es `invalid_definition`.
- **Falla cerrado.** Con `ready: false` el bot no responde. `missing_config`, `no_published_version` e `invalid_definition` registran un evento
  `error` (`detail.motivo`) y un `logger.warn`; `disabled` es silencioso. Un error de base de datos al cargar se captura (evento `error` con
  `config_no_disponible` si se puede escribir) y no afecta el 200 a Meta ni el aviso push.
- **Ids.** `BOT:<nodo>:<opcion>` resuelve contra la definicion publicada; `BOT:ACC:<LOGIN|TRAVEL>:<serviceId>` sigue igual. Alias de
  compatibilidad para mensajes ya enviados: `BOT:NFX:LOGIN` y `BOT:NFX:TRAVEL` ejecutan la accion de codigo, `BOT:SUPPORT` el pase a una persona
  y `BOT:NETFLIX` reenvia el nodo de entrada; no dependen de que el flujo conserve los nodos antiguos. Un nodo u opcion que ya no existe responde
  `option_unavailable` **y** el nodo de entrada en un solo mensaje (cada mensaje entrante tiene una unica respuesta: la clave de idempotencia deriva de el).
- **Textos.** Todo sale de `definition.messages` y de los nodos, con `renderTemplate`. Si un mensaje perdio un marcador obligatorio (o esta vacio) se usa el
  texto por defecto del catalogo, de modo que nunca sale un mensaje de codigo sin el codigo; los marcadores sin valor se muestran vacios.
  `{{minutos}}` es la ventana del tipo de codigo (`loginWindowMinutes` / `travelWindowMinutes`) o, en `rate_limited`, `tapWindowMinutes`.
  Los avisos `login_not_found` y `travel_not_found` llevan, si el flujo lo tiene, el boton que conduce a esa accion.
- **Fijo, no configurable:** el texto guardado en el chat para ocultar codigos y enlaces (`BOT_STORED_TEXT`), el cruce por perfil, los claims, el enlace
  exacto de Netflix, el buzon de solo lectura y que solo respondan clientes registrados con cuenta de Netflix.
- **Parametros que ya mandan:** `menuIdleHours`, `operatorQuietMinutes` (con 0 no se consulta si respondio una persona), `loginWindowMinutes`,
  `travelWindowMinutes` (parametro de `recentMailsByAccount`), `maxTaps` y `tapWindowMinutes`, ademas de las palabras clave.
- **Eventos** (`createBotEventsStore().record`): `menu_shown`, `option_selected`, `code_sent`, `link_sent`, `not_found`, `already_sent`,
  `profile_blocked` (sin perfil o solicitud de otro perfil), `rate_limited`, `mailbox_unavailable`, `handoff`, `option_unavailable` y `error`
  (envio fallido, bot fallido, configuracion). Llevan `cliente_id` (`customerServices` ahora devuelve `clienteId`) y un `detail` con claves en espanol
  (`tipo`, `cuenta`, `perfil`, `motivo`...); nunca codigos, enlaces ni contrasenas. Un fallo al registrar un evento se captura con `logger.warn`
  y no cambia la respuesta al cliente.
- **Pantalla.** `/automatizaciones` y su entrada del menu siguen el patron de las paginas de administrador (`user.role === 'admin'` en la pagina y `adminOnlyPaths` en el menu); la
  autorizacion real esta en RLS/RPC y en `requireAuthenticatedAdmin` de la API. `src/app/(dashboard)/automatizaciones/page.test.tsx` recorre pagina, hook real y
  caso de uso (simulado) para el interruptor y la publicacion.
- **Pendiente para el usuario:** borrar `WHATSAPP_BOT_ENABLED` de Vercel y de `.env.local`; encender el bot desde `/automatizaciones`; comprobar que el nombre de perfil
  de cada venta de Netflix coincide con el de Netflix (sin eso el cruce por perfil bloquea el codigo de viaje).
# Recorridos comerciales

Además de acceso Netflix y atención humana, los nodos de acción admiten `purchase`,
`renewal` y `my_services`. Su implementación verifica catálogo/propiedad en el
servidor y exige un resumen confirmado antes de reservar. El simulador describe
los pasos sin crear pedidos ni ejecutar pagos. Consulta
[procesamiento persistente](whatsapp-durable-processing.md) para recuperación,
control humano y preparación del scheduler.

## Flujo de compras como bloques del lienzo (Fase 3)

Los bloques de compra estan siempre disponibles (la bandera `COMMERCE_FLOW_CANVAS_ENABLED` se retiro). Sus textos se editan en
**Editor → Flujo de compra** (y en Respuestas) **sin agregar nada antes**: si el borrador aun no tiene los bloques se muestran con
los textos vigentes y se crean, sin enlazar, con la primera edicion (`withPurchaseBlocks`). Un bloque que ningun boton alcanza
no es un error de validacion (solo guarda textos; el bot no lo recorre) y el lienzo lo oculta hasta que un boton lleve a el.
Los bloques son cuatro nodos `buttons` con identidad fija (`compra_catalogo`, `compra_resumen`,
`compra_reserva`, `compra_pago`) y un campo opcional `block: { type, copy }`. Solo se editan textos, titulos de botones
(derivados del texto) y a donde vuelve «cancelar». Las reglas de elegir, reservar, pagar, entregar y reembolsar siguen en
`commerce-conversation-*` y en SQL/RPC; el grafo no las toca.

- **Compatibilidad:** no hay SQL ni valores nuevos en los enums; la version anterior ignora `block` y lee los nodos como
  botones normales. Si se vuelve a una version anterior de la aplicacion con bloques publicados, los bloques se muestran
  como menus de texto fijo (no compran): restaurar una version previa del recorrido lo corrige.
- **Entrada:** un boton del recorrido lleva a `compra_catalogo`; `commerceCommand` lo trata como «comprar» con la bandera
  encendida o no.
- **Validacion** (`validate-blocks.ts`, errores bloqueantes): bloques sin bandera; flujo incompleto o repetido; id, tipo de
  nodo o botones distintos de los fijos; conexion entre bloques alterada; «cancelar» hacia otro bloque; nodos ajenos que
  lleven a resumen, reserva o pago (no se reserva sin confirmar el resumen ni se llega al pago o la entrega sin reservar);
  textos que incumplen las reglas de su mensaje.
- **Runtime:** con la bandera encendida y bloques en la version publicada, los textos del grafo se suman (con prioridad)
  a los de `mt_commerce_copy`; `createCopy` vuelve al original si alguno no cumple. Con la bandera apagada solo cuentan
  los de `mt_commerce_copy`. La pestana Compras se retiro: los textos de compra se editan solo en el lienzo, que muestra el texto vigente (bloque, luego el guardado en base de datos, luego el original).
- **Limite:** publicar es una RPC de administrador desde el navegador; el bloqueo de publicacion con la bandera apagada es
  de aplicacion. La carga en el webhook valida estructura y orden pero no la bandera.

## Extensiones del recorrido (Fase 4)

Sin SQL nuevo ni valores nuevos en los enums: todo viaja en campos opcionales de la definicion `jsonb`, que la version
anterior ignora (`z.object` no estricto).

- **Pasar a una persona desde cualquier nodo** (sin bandera): cada nodo de botones o lista (lienzo y panel) tiene
  «Agregar salida a una persona». Agrega la salida «Hablar con alguien» hacia el nodo de accion `handoff` que ya exista
  (o lo crea, `pasar_a_persona`). No duplica la salida y respeta los limites de botones/filas y de nodos (`edit-extensions.ts`).
  Los nodos de texto y de accion son finales y no tienen salidas.
- **Plantillas** (sin bandera propia): «Recorrido base» y «Recorrido base + compras» reemplazan el borrador (no lo publicado)
  tras confirmar. La segunda siembra los textos de
  compras editados hoy (`templates.ts`).
- **Comparar versiones** (sin bandera): Versiones, «Comparar versiones», usa `diffDefinitions` entre dos versiones guardadas
  (`compareBotVersionsUseCase`, solo lectura: no toca el borrador ni deja registro). `diffDefinitions` ahora tambien
  describe condiciones y textos de bloques.
- **Condiciones y datos del pedido** (bandera `FLOW_EXTENSIONS_ENABLED=true`, servidor, apagada por defecto, sin `NEXT_PUBLIC_`;
  se informa a la UI por `/api/whatsapp/bot/health` como `flowExtensionsEnabled`):
  - Una condicion es un nodo `buttons` normal con el campo opcional `condition: { type }` y exactamente dos salidas `si` / `no`.
    La version anterior lo muestra como un menu de dos botones; la actual lo resuelve en el servidor sin mostrarlo. Tipos
    cerrados: `customer_has_services` (existente: al menos un servicio de Netflix activo, dato que el bot ya carga) y
    `catalog_has_stock` (algun plan del catalogo con perfiles libres, `listCatalogoServerUseCase`; si no se puede leer se toma
    «sin cupo»). Reglas: no puede ser un bloque, no cambia de tipo de nodo, sus salidas no se agregan ni se
    renombran, hasta 5 condiciones seguidas (`MAX_CONDITION_HOPS`; despues no se envia nada nuevo). Cada decision queda en los eventos del bot
    (`option_selected` con `condicion`, `respuesta`, `destino`).
  - **Condicion como entrada (opt-in; la plantilla base no cambia).** «Usar como entrada» (`setEntryNode`, solo nodos que existen y que no
    son bloques de compra ni acciones; la entrada sigue sin poder borrarse) permite que el primer paso sea una condicion, p. ej.
    «¿Cliente existente?»: Existente -> menu de clientes, Nuevo -> bienvenida. El cliente nunca ve la condicion: el servidor elige la
    salida y le muestra el nodo destino. Validacion (errores bloqueantes): las dos salidas deben llevar a destinos distintos y
    existentes (en una condicion que no es la entrada sigue siendo solo aviso), ninguna cadena de condiciones alcanzable desde la
    entrada puede volver sobre si misma ni pasar de 5 condiciones seguidas. Runtime (`followConditions` en todos los puntos que
    parten de la entrada: palabra clave, reinicio por inactividad, «volver al menu», opcion inexistente): un cliente sin servicios
    ya no se ignora si la entrada es una condicion, y el evento `menu_shown` registra el nodo realmente mostrado (no hay estado de
    conversacion: los botones llevan el id del nodo mostrado). Si la salida que toca no lleva a un nodo existente se usa la otra;
    si ninguna es valida (o la cadena pasa del limite) no se envia nada, sin errores; la validacion lo impide al publicar. El runtime
    no consulta la bandera: una version ya publicada con condicion de entrada sigue funcionando aunque se apague.
  - Datos del pedido: lista blanca cerrada en los textos de nodos (no en titulos ni descripciones): `{{pedido_total}}`,
    `{{pedido_estado}}`, `{{pedido_pendiente}}`, `{{pedido_servicios}}`, `{{pedido_vence}}`. Se resuelven en el servidor desde el
    pedido de la conversacion (`getPedidoServerUseCase`, que valida que sea del mismo numero) y nunca incluyen ids, nombres,
    correos, telefonos ni credenciales. Sin pedido o ante un fallo se muestra «—». Cualquier otro marcador sigue siendo un error.
  - Sin la bandera, `validateDefinition` y `publishBotUseCase` rechazan (error bloqueante) condiciones y datos del pedido, de modo
    que no se pueden publicar. El runtime los resuelve siempre que existan en la version publicada (la carga valida con la bandera
    asumida encendida), asi que apagarla despues no silencia el bot.
  - **Activacion:** definir `FLOW_EXTENSIONS_ENABLED=true` en el entorno del servidor tras desplegar la version nueva en todo el
    entorno (si una instancia anterior sigue activa, vera estos nodos como menus de dos botones y los marcadores sin resolver).
    Para volver atras, restaurar una version publicada anterior del recorrido y despues apagar la bandera. Publicar con la
    version anterior de la aplicacion pierde los campos nuevos (los descarta al parsear).
- **Simulador:** con condiciones o datos del pedido en el borrador aparece «Datos de ejemplo de la simulación»: interruptores para
  cada condicion y valores editables para cada dato. No consulta clientes ni envia mensajes; reiniciar aplica los cambios.

## Mensajes propios por plataforma y plan

`BotDefinition.catalogMessages` (opcional) guarda textos propios de cada plataforma y de cada plan del catálogo, por id, y viaja con la definición: se edita en el borrador y se publica con el bot, sin cambios de base de datos.

- Plataforma: `chosen` (lo que se dice al elegirla y mostrar sus planes) y `rowDescription` (línea bajo su nombre en la lista de plataformas).
- Plan: `added` (lo que se dice al agregarlo a la selección) y `rowDescription` (línea bajo su nombre en la lista de planes).
- Lo que falta usa el texto general del flujo de compra (`commerce-copy`); un texto que no cumple las reglas (`catalogMessageProblem`) bloquea publicar y, si llegara a publicarse, el bot lo ignora y usa el general.
- Marcadores por campo en `CATALOG_MESSAGE_FIELDS` (`bot-config/catalog-messages.ts`). Tope de 200 plataformas y 200 planes con mensaje propio.
- Se edita en Automatizaciones → Editor → «Flujo de compra» → «Mensajes por servicio». El simulador todavía no los refleja.

## Textos que continúan o esperan la respuesta del cliente

Un nodo de texto ya no tiene que ser el final. Su campo opcional `after` decide qué pasa después (la versión anterior de la aplicación lo
ignora: `z.object` no es estricto y lee el nodo como texto final):

| `after` | Salidas (`options`) | Qué hace el bot |
|---|---|---|
| sin valor | ninguna | El texto es final. La conversación queda ahí hasta que el cliente escriba algo que active el menú. |
| `{ mode: 'continue' }` | exactamente una (su título no se usa) | Sigue solo con el nodo al que lleva. **Cada mensaje recibido tiene una sola respuesta**, así que el texto viaja delante del nodo siguiente, en el mismo mensaje (igual que el aviso que acompaña a un nodo). |
| `{ mode: 'wait', hours }` | de 1 a 10 respuestas | Envía el texto y espera lo que escriba el cliente (1 a 72 horas, 12 por defecto). Sigue por la salida que coincide. |

**Respuestas escritas.** El título de cada salida son las palabras que la identifican, separadas por comas («sí, claro, ok»). Coincide si lo
escrito incluye alguna como palabra completa, sin importar acentos ni mayúsculas (una frase de varias palabras debe aparecer completa).
Gana la primera que coincide, en el orden del editor. La salida marcada `any: true` es «cualquier otra respuesta» (sin palabras; solo una).
Si nada coincide y no hay «cualquier otra respuesta», el bot no contesta y el mensaje es un chat normal (una palabra del menú, como «hola», sigue abriéndolo).

**Estado de la espera.** Tabla `whatsapp_bot_waits` (`wa_id` único, `node_id`, `expires_at`), solo para el servidor: RLS activa, sin acceso para
`anon` ni `authenticated` y `SELECT/INSERT/UPDATE/DELETE` solo para `service_role`. Cada cliente espera una sola respuesta a la vez. Se borra
después de entregar la respuesta (una reentrega del mismo mensaje todavía la encuentra), al tocar cualquier botón del menú, o cuando el texto ya no
existe, y se limpia lo vencido al guardar otra. Si falla la lectura prioritaria, el mensaje se reintenta y no cae en compras. Expand-only: la versión anterior ignora la tabla.

La espera del recorrido se evalúa antes de compras. Al entrar en otro nodo, compras queda pausada (`context.paused`) sin cancelar el carrito ni el pedido.
Solo un botón `SHOP:` o una delegación explícita a una acción de compras vuelve a darle el turno; los mensajes escritos de soporte no reactivan compras.

**Validación** (`validate-nodes.ts`, errores bloqueantes salvo que se diga): continuar exige una salida; esperar exige al menos una, como máximo 10, solo
una «cualquier otra», palabras en cada respuesta (hasta 60 caracteres) y un número entero de horas entre 1 y 72; una cadena de textos que
continúan no puede dar vueltas ni pasar de 5 mensajes seguidos, y el texto junto con el del paso donde termina debe caber en 1024 caracteres; si el paso
siguiente es una acción que no admite un texto antes (todas salvo pasar a una persona) es un **aviso**. Un texto que continúa no cuenta como final
(el final está donde llega); uno que espera sí. `after` en un nodo que no es de texto se ignora con un aviso.

El editor lo ofrece en el inspector de un texto («Después de este mensaje»), el simulador lo recorre (el texto que espera muestra un campo para escribir
la respuesta del cliente) y el lienzo muestra las salidas con su etiqueta («Continúa», las palabras, «Cualquier otra respuesta»).

## Datos de acceso del cliente (acción `service_access`)

«Enviar mis datos de acceso» no está ligada a la compra: es una acción más del catálogo, que se conecta donde se quiera (el editor tiene «Agregar paso →
Datos de acceso del cliente»). El cliente recibe la plantilla independiente **Datos de acceso solicitados** (`datos_acceso`), en
Plantillas de mensajes → Respuestas automáticas, con el correo, la contraseña, el perfil y lo demás según la plataforma.
También se usa al tocar un botón `DATOS` de un aviso. La bienvenida al crear una venta sigue usando **Notificación de Suscripción**.

- **Solo lo suyo.** Las ventas salen del número que escribe: debe pertenecer a un único cliente activo; la venta debe estar activa y vigente, de un servicio
  en uso (no en reposo, cortado ni archivado) y sin reembolso en su último periodo. Con varios servicios el bot manda una lista para elegir de cuál
  (`BOT:ACCESS:<venta>`); el identificador elegido se vuelve a comprobar contra las ventas del número, así que uno ajeno nunca devuelve datos.
- **Servicios que entran con código** (política `mt_service_access.mode = 'code'`, p. ej. Netflix): no se envían la contraseña ni el PIN; se añade el aviso
  «access_code_notice» para pedir el código desde el menú.
- **Seguridad.** El cliente recibe el texto real; el chat guarda el mismo texto con la contraseña y el PIN ocultos. Los eventos no llevan datos de la venta
  (`option_selected` con `destino: datos_acceso`, `not_found`, `rate_limited`, `error`). Aplica el límite de pulsaciones del menú. Sin cambios de SQL ni RPC:
  usa lecturas del servidor con el rol de servicio, como el resto del bot.
- **Textos editables** (Respuestas): `access_none`, `access_picker_body`, `access_picker_button`, `access_code_notice` y `access_unavailable`. Una versión
  ya publicada que no los trae se completa con los textos por defecto al leerla (`parseDefinition`), así que publicar esta versión de la aplicación no apaga el bot.
