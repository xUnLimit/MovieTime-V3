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
acciones alcanzables, marcadores permitidos y obligatorios, sin nodos inalcanzables desde la entrada (error), sin ciclos sin salida
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

## 6. Pantalla Bot (`/bot`, entrada "Bot" en el menu lateral)

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
3. **Mensajes**: una tarjeta por mensaje del sistema con descripcion de cuando se envia, marcadores disponibles
   (chips insertables), contador, vista previa con datos de ejemplo y "Restablecer" al valor por defecto.
4. **Reglas**: parametros con explicacion y rango, editor de palabras clave.
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
| UI | `src/app/(dashboard)/bot/page.tsx`, `src/components/bot/**` |

## 8. Pruebas y calidad

Unitarias de cada funcion pura y rama de casos de uso; repositorio con cliente falso; pgTAP de tablas, RLS y RPC
(anon sin acceso, no administrador rechazado, version inmutable, publicar atomico); pruebas de componentes de la
UI; E2E o accesibilidad de `/bot` si el patron del repo lo permite. Cobertura 80/70 en lo cambiado y 90/80 en
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
- **Pantalla.** `/bot` y su entrada del menu siguen el patron de `/pagos-yappy` (`user.role === 'admin'` en la pagina y `adminOnlyPaths` en el menu); la
  autorizacion real esta en RLS/RPC y en `requireAuthenticatedAdmin` de la API. `src/app/(dashboard)/bot/page.test.tsx` recorre pagina, hook real y
  caso de uso (simulado) para el interruptor y la publicacion.
- **Pendiente para el usuario:** borrar `WHATSAPP_BOT_ENABLED` de Vercel y de `.env.local`; encender el bot desde `/bot`; comprobar que el nombre de perfil
  de cada venta de Netflix coincide con el de Netflix (sin eso el cruce por perfil bloquea el codigo de viaje).
# Recorridos comerciales

Además de acceso Netflix y atención humana, los nodos de acción admiten `purchase`,
`renewal` y `my_services`. Su implementación verifica catálogo/propiedad en el
servidor y exige un resumen confirmado antes de reservar. El simulador describe
los pasos sin crear pedidos ni ejecutar pagos. Consulta
[procesamiento persistente](whatsapp-durable-processing.md) para recuperación,
control humano y preparación del scheduler.

## Flujo de compras como bloques del lienzo (Fase 3)

Con la variable de servidor `COMMERCE_FLOW_CANVAS_ENABLED=true` (apagada por defecto, sin `NEXT_PUBLIC_`) el editor
ofrece **Agregar flujo de compras**: cuatro nodos `buttons` con identidad fija (`compra_catalogo`, `compra_resumen`,
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
  los de `mt_commerce_copy`. La pestana Compras remite al lienzo cuando ambas condiciones se cumplen.
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
  tras confirmar. La segunda exige los bloques de compra activados (`COMMERCE_FLOW_CANVAS_ENABLED`) y siembra los textos de
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
    «sin cupo»). Reglas: no puede ser el nodo de entrada ni un bloque, no cambia de tipo de nodo, sus salidas no se agregan ni se
    renombran, hasta 5 condiciones seguidas (despues no se envia nada nuevo). Cada decision queda en los eventos del bot
    (`option_selected` con `condicion`, `respuesta`, `destino`).
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
