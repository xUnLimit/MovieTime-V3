# MovieTime PTY - reglas obligatorias de ingenieria

Este archivo es la fuente canonica para personas y agentes de IA. `CLAUDE.md` y cualquier configuracion de editor deben remitir aqui y no duplicar estas reglas.

## Definicion de terminado

- Un cambio no esta terminado hasta que `npm run quality:full` pasa desde un checkout reproducible.
- Durante iteracion puede usarse `npm run quality:fast`, pero no reemplaza el gate completo.
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
- Usa `assertOnlineMutation()`, `withIdempotencyKey()` y `assertRpcStringId()`; nunca conviertas respuestas RPC con `String(data)`.
- Si un pago cambia el periodo vigente, ambos cambios deben ser atomicos.
- Las migraciones son forward-only y expand/contract: una migracion debe ser compatible con la version anterior de la aplicacion.
- No edites el esquema productivo a mano, no uses seeds en produccion y nunca ejecutes reset remoto contra produccion.

## Errores, tipos y observabilidad

- TypeScript permanece en modo estricto. No uses `any`, `@ts-ignore` ni casts para ocultar contratos rotos.
- No uses `.catch(() => {})`. Usa `safeAsyncSideEffect` o `try/catch` explicito con contexto.
- Conserva `detalles` para texto visible de actividad y `metadata` para auditoria estructurada.
- Las integraciones externas deben definir timeout, error controlado y politica de reintento/idempotencia cuando corresponda.
- Los endpoints deben producir IDs de solicitud y respuestas `no-store` cuando contienen datos privados u operativos.

## Pruebas y calidad

- Agrega unit tests para helpers puros y ramas de casos de uso.
- Agrega integracion para ventas, servicios, pagos, renovaciones, RLS, rollback y proyecciones financieras.
- El codigo cambiado exige al menos 80% de lineas/funciones y 70% de ramas.
- Auth, autorizacion, pagos, reembolsos, RLS y migraciones exigen 90% de lineas/funciones y 80% de ramas.
- Los flujos publicos nuevos deben incluir smoke E2E, accesibilidad sin impactos serios/criticos y presupuesto de rendimiento.
- Mantener cero errores y cero warnings de ESLint, typecheck de aplicacion y tests, build productivo y arquitectura en verde.

## Release

- `main` puede recibir commits directos, pero solo GitHub Actions puede promover a produccion.
- Produccion requiere todos los jobs verdes, credenciales completas, migraciones verificadas, deployment staged, smoke tests y promocion explicita.
- Si falla antes de promover, el staged deployment se descarta. Si falla despues, se ejecuta rollback del frontend.
- El rollback del frontend no revierte la base de datos; por eso las migraciones siempre deben ser compatibles hacia atras.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
