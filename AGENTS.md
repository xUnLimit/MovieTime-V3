# MovieTime PTY - reglas obligatorias de ingenieria

Este archivo es la fuente canonica y unica para personas y agentes de IA.

## Definicion de terminado

- Un cambio no esta terminado hasta que `npm run quality:full` pasa desde un checkout reproducible.
- Durante iteracion puede usarse `npm run quality:fast`, pero no reemplaza el gate completo.
- `quality:fast` y `quality:full` deben incluir `arch:check`, `module-size`, `ci:parity` y `dead-code`; `quality:full` tambien exige `coverage:baseline` tras `test:coverage`.
- La aprobacion de un PR requiere ademas los jobs de CI: CodeQL, SBOM, migraciones desde cero, `test:db`, `test:integration` y E2E autenticado. Mutacion y controles de deriva corren de noche. Consulta [`docs/QA.md`](docs/QA.md) para los comandos y su alcance.
- Todo cambio funcional o correccion debe incluir pruebas de la conducta nueva y de la regresion relevante.
- Nunca reduzcas umbrales, omitas pruebas, desactives reglas o agregues excepciones para hacer pasar un cambio.
- Una excepcion de dependencia de desarrollo requiere advisory, propietario, motivo, mitigacion, fecha de creacion y vencimiento de hasta 30 dias. Produccion no admite excepciones.
- No hagas commit, push ni despliegue salvo solicitud explicita del usuario.

## Seguridad

- Valida toda entrada no confiable en el limite del sistema con Zod o una validacion equivalente, incluyendo cuerpo, query, params, headers y webhooks.
- Autentica y autoriza en el servidor. Ocultar controles en la UI nunca es autorizacion.
- Valida IDs de rutas con `isUuid`/`assertUuid` antes de consultar Supabase.
- RLS debe estar activa en cada tabla de aplicacion. Las funciones `SECURITY DEFINER` deben fijar un `search_path` seguro y tener grants minimos.
- Nunca expongas `SUPABASE_SERVICE_ROLE_KEY`, claves privadas ni secretos con prefijo `NEXT_PUBLIC_`.
- No guardes secretos en codigo, fixtures reales, logs, errores publicos, artefactos o snapshots.
- No registres contrasenas, tokens, cookies, headers de autorizacion ni datos personales completos. Usa el logger central, que aplica redaccion.
- No devuelvas detalles SQL, stack traces ni mensajes internos al cliente. Usa errores publicos tipados.
- No uses `eval`, `new Function`, HTML sin sanitizar, comandos construidos con entrada, regex dinamicas no acotadas ni rutas de archivo no validadas.
- Importa Zod exclusivamente desde `@/platform/validation/zod`; el adaptador activa `jitless` antes de crear esquemas para respetar la CSP sin `unsafe-eval`.
- Toda dependencia nueva necesita una razon concreta y debe pasar `security:audit:prod` y `security:audit:all`.
- Los avisos conocidos en dependencias ejecutables deben ser cero. El arbol completo debe estar libre de avisos salvo una excepcion temporal valida de tooling.

## Arquitectura y dominio

- `src/platform/` contiene infraestructura transversal y no importa `application/`, `modules/`, `@/store` ni React/UI.
- `src/modules/<context>/` contiene logica cohesionada y solo importa sus propios archivos y `platform/`; no importa stores, application, React ni interiores de otros modulos.
- `src/application/` orquesta negocio y puede importar `modules/` y `platform/`; no importa stores, hooks, componentes ni React.
- `src/store/` contiene estado UI/auth/PWA/filtros. No contiene reglas transaccionales y no accede a Supabase directamente.
- `src/app`, `src/components` y `src/hooks` presentan UI y llaman hooks, comandos o casos de uso; no llaman Supabase directamente.
- Los repositorios son adaptadores finos. Las decisiones de negocio viven en casos de uso.
- La identidad y el contexto de logs se inyectan desde el composition root; un caso de uso no lee stores globales.
- SQL/RPC es la fuente de verdad para invariantes atomicas de pagos, periodos, reembolsos y rollback.
- Un evento de dominio tiene un solo emisor: el caso de uso. Las reacciones no vuelven a emitirlo.
- Usa `StoreEventBus`; no agregues eventos de negocio con `window.dispatchEvent` o `localStorage`.
- No crees un `lib/` generico, agregadores paralelos ni otra capa de mutaciones.
- Mantener modulos de produccion por debajo de 300 lineas, salvo excepcion arquitectonica documentada.

## Escrituras criticas

- Pagos, reembolsos, renovaciones y cambios de periodo pasan por un RPC tipado.
- Usa `assertOnlineMutation()`, `executeIdempotentRpc()` (en los adapters `*-rpc-adapter`) y `assertRpcStringId()`; nunca conviertas respuestas RPC con `String(data)`.
- Si un pago cambia el periodo vigente, ambos cambios deben ser atomicos.
- Las migraciones son forward-only y expand/contract: una migracion debe ser compatible con la version anterior de la aplicacion.
- No edites el esquema productivo a mano, no uses seeds en produccion y nunca ejecutes reset remoto contra produccion.

## Errores, tipos y observabilidad

- TypeScript permanece en modo estricto. No uses `any`, `@ts-ignore` ni casts para ocultar contratos rotos.
- No uses `.catch(() => {})`. Usa `safeAsyncSideEffect` o `try/catch` explicito con contexto.
- Conserva `detalles` para texto visible de actividad y `metadata` para auditoria estructurada.
- Las integraciones externas deben definir timeout, error controlado y politica de reintento/idempotencia cuando corresponda.
- Los endpoints deben producir IDs de solicitud y respuestas `no-store` cuando contienen datos privados u operativos.

## Diseno de UI

- Toda UI se rige por [`DESIGN.md`](DESIGN.md): lee ese archivo antes de crear o modificar pantallas o componentes.
- Usa tokens semanticos y los componentes compartidos (`PageHeader`, `MetricCard`/`MetricGrid`, `Panel`, `StatusBadge`, `DataTable`); no uses colores de paleta cruda, hexadecimales en clases, tamanos de fuente fuera de 12/14/16/20 ni pesos distintos de normal/medium/semibold.
- Las tablas siguen las medidas de la seccion 6 de `DESIGN.md` (referencia: Ventas; fila 49px, 10 filas, sin scroll horizontal, dato secundario en segunda linea, montos con simbolo verde). Tras tocar una tabla, comparala con Ventas en el navegador al cambiar de pagina y de pestana.
- `npm run design:check` debe pasar; forma parte de `quality:fast` y `quality:full`. No lo omitas ni agregues excepciones: si falta un token o variante, agregalo a `globals.css` y documentalo en `DESIGN.md`.

## Pruebas y calidad

- Agrega unit tests para helpers puros y ramas de casos de uso.
- Agrega integracion para ventas, servicios, pagos, renovaciones, RLS, rollback y proyecciones financieras.
- El codigo cambiado exige al menos 80% de lineas/funciones y 70% de ramas.
- Auth, autorizacion, pagos, reembolsos, RLS y migraciones exigen 90% de lineas/funciones y 80% de ramas.
- Los flujos publicos nuevos deben incluir smoke E2E, accesibilidad sin impactos serios/criticos y presupuesto de rendimiento.
- `npm run dead-code` (Knip) debe pasar con cero hallazgos: archivos, exportaciones, tipos y dependencias sin usar. Forma parte de `quality:fast` y `quality:full`. No lo omitas ni agregues excepciones: elimina el codigo muerto, o declara en `knip.json` solo un punto de entrada real que se cargue por ruta.
- Mantener cero errores y cero warnings de ESLint, typecheck de aplicacion y tests, build productivo y arquitectura en verde.

## Release

- `main` puede recibir commits directos, pero solo GitHub Actions puede promover a produccion.
- Produccion requiere todos los jobs verdes, credenciales completas, migraciones verificadas, deployment staged, smoke tests y promocion explicita.
- Si falla antes de promover, el staged deployment se descarta. Si falla despues, se ejecuta rollback del frontend.
- El rollback del frontend no revierte la base de datos; por eso las migraciones siempre deben ser compatibles hacia atras.

## Navegacion del codigo con Graphify

- El mapa local vive en `graphify-out/graph.json`; la skill esta en `.agents/skills/graphify/SKILL.md`. Para arquitectura, investigacion de errores, revisiones y cambios que abarcan varios archivos, consulta primero el grafo y lee despues las fuentes relevantes. Carga solo la referencia de la skill necesaria para la tarea.
- En PowerShell, si la CLI no esta en PATH, prueba primero el interprete instalado registrado en `graphify-out/.graphify_python`, comprobando que existe y puede importar Graphify, con `-m graphify`. Si el usuario pide no usar el grafo, la tarea ya identifica un archivo y cambio puntual, o Graphify sigue sin estar disponible, usa `rg` y lectura dirigida sin bloquear el trabajo. La ausencia del grafo no exige instalar herramientas ni reconstruir todo el proyecto.
- Prefiere `graphify explain "ruta::simbolo"` para una funcion concreta, `graphify path "ID_A" "ID_B"` para una relacion y `graphify affected "ID_del_nodo"` para explorar impacto. Usa `graphify query "terminos" --budget 1500` para descubrir el contexto inicial. Desambigua coincidencias con la ruta relativa o el ID completo; para `path` y `affected`, usa IDs exactos cuando haya ambiguedad.
- Formula consultas con nombres reales de funciones, archivos y conceptos del grafo. Para preguntas generales en espanol, selecciona pocos terminos pertinentes del vocabulario real; reutiliza esa seleccion mientras el grafo no cambie. Evita consultas genericas que solo devuelven hubs como React o Vitest.
- No cargues el JSON completo, todos los nodos ni el informe completo en el contexto. Reserva `GRAPH_REPORT.md` para una vista general y lee solo sus secciones utiles. Si la respuesta se trunca o no encuentra el simbolo, acota por ruta o relacion; amplia el presupuesto solo cuando haga falta. Si sigue sin responder, busca en las fuentes con `rg`.
- Antes de editar, comprueba en el codigo actual la implementacion, sus llamadores, contratos y pruebas relevantes. El grafo orienta la seleccion de archivos; no reemplaza leerlos, autenticar, autorizar ni validar las invariantes SQL/RPC.
- Comprueba la vigencia de los archivos del alcance frente al manifiesto del grafo y a los cambios locales. Un grafo desactualizado, un cambio de rama o una referencia no resuelta exige verificar las fuentes y actualizar el alcance necesario; no presupongas que todo el mapa describe el checkout actual.
- Tras cambios de codigo o SQL, ejecuta `graphify update .` para mantener el mapa estructural. Ese comando no sustituye la extraccion semantica de documentos e imagenes: cuando cambien, actualiza los archivos afectados con la skill incremental y conserva pendientes los que no pudieron procesarse. Evita reconstrucciones completas y exportaciones HTML salvo que sean necesarias o solicitadas.
- La ausencia de aristas no demuestra codigo muerto; los nombres iguales no demuestran equivalencia; el numero de conexiones no demuestra un defecto. Confirma codigo innecesario con `dead-code` y busquedas de entradas dinamicas, y dependencias problematicas con `arch:check`. Compara contratos antes de proponer unificacion.
- En un hallazgo, distingue evidencia extraida, inferencia y problema comprobado. Cita archivo y linea actuales, explica el efecto y verifica la conducta con las pruebas apropiadas. Las advertencias del extractor son limites del mapa, no errores de la aplicacion.
- Al iniciar una investigacion extensa, consulta las lecciones de Graphify si existen. Guarda solo conclusiones verificadas y utiles con `save-result`, incluyendo sus fuentes; no registres secretos, datos personales, conversaciones completas ni hipotesis como hechos. El ahorro de tokens del benchmark es una estimacion frente a su corpus de referencia, no una garantia por conversacion.
- Los artefactos de `graphify-out/` son herramientas locales: respeta exclusiones de secretos, sesiones, dependencias y builds. No cambies las reglas de seguridad, arquitectura, cobertura o `quality:full` para acomodar el grafo. No instales hooks, MCP, servicios ni configuraciones paralelas para aplicar estas instrucciones.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
