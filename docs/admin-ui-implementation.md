# Funciones administrativas: catálogo, interesados, chats y acceso por código

## Pantallas y comportamiento

- `/interesados`: acceso admin y entrada de menú; métricas de personas únicas por plataforma y espera más antigua; demanda por plataforma/plan contra disponibilidad; clientes o leads con teléfono enmascarado; búsqueda, filtros por plataforma/estado, 10 filas de 49px, chat por `wa_id` y cierre como atendido (`convertido`) o descartado.
- `/catalogo`: acceso admin dentro de la sección de navegación de categorías; ajustes globales de TTL, moneda y resumen; botones de marcadores `{{disponibles}}` / `{{agotados}}` y vista previa en vivo; configuración por plataforma o plan de visibilidad, orden, umbral y alternativa; disponibilidad de solo lectura y stock bajo. Una categoría aporta valores iniciales a sus planes sin configuración propia. Guardar un plan crea una configuración explícita.
- Chats: dueño visible, tomar conversación y devolver al bot por repositorio → caso de uso → hook. Lectura cada 5 segundos y actualización posterior al RPC, sin mostrar éxito anticipado. El runtime consulta el dueño persistido y permanece silencioso con dueño humano; falla cerrado ante errores de lectura. Un chat sin estado se considera atendido por el bot.
- Acceso por código: la casilla consulta clientes activos para cuentas existentes. Con clientes, abre un diálogo antes de aplicar el cambio y ofrece cancelar, cambiar sin aviso o cambiar y avisar al guardar. Activar recuerda cambiar la contraseña en la plataforma. Desactivar ofrece compartir las credenciales vigentes. Sin guardar no se envía nada. La preferencia de envío se conserva solo en memoria del formulario.
- Avisos: reutilizan `announceNotice` y `actualizacion_credenciales`, con idempotencia por cambio. Con acceso por código usan texto sin credenciales y el botón «Solicitar código» en la ventana abierta. Fuera de la ventana necesitan una plantilla Meta aprobada con un único botón «Solicitar código» y parámetros permitidos. Los botones de plantilla ahora llegan al flujo existente de solicitud. Avisos de credenciales consideran a clientes activos aunque hayan pedido no renovar o tengan promesa de pago.
- `/design-lab/admin`: vista solo de desarrollo, sin sesión, con 23 interesados sintéticos, paginación y pestañas para ambas pantallas. Las mutaciones de la vista previa modifican solo su caché local; no consultan ni escriben en Supabase.

## Arquitectura y límites de datos

Las pantallas llaman hooks de React Query; los hooks llaman casos de uso; los casos de uso validan contratos y usan repositorios. Los repositorios nuevos usan consultas acotadas a 10 segundos, sin reintentos de escritura. Las colecciones se leen en lotes de 500 para evitar truncarlas por el límite de respuestas de Supabase. La disponibilidad por plataforma deduplica los planes que comparten un tipo de inventario.

La restricción del menú y los casos de uso complementan la autorización real del servidor: RLS admin ya existente en catálogo/estado, RPC admin de atención y nueva política admin para actualizar intereses. No se cambiaron claves, dependencias, umbrales de calidad, excepciones ni reglas de diseño.

## Migración local

`supabase/migrations/20261004050000_admin_interest_updates.sql` es compatible con el backend anterior:

- Concede únicamente `UPDATE (estado)` sobre intereses y agrega una política admin con `USING` y `WITH CHECK`.
- Extiende `take_over_conversation(text)` para crear el primer estado humano de chats anteriores usando el flujo publicado, sin inventar una versión. Mantiene el contrato booleano anterior, validación del `wa_id`, control admin, `SECURITY DEFINER` con `search_path = ''` y ejecución solo authenticated.
- No requiere backfill, reset, seeds ni cambios manuales de esquema.

La migración **no se ejecutó en ninguna base de datos**.

## Validación

- `npx vitest run --configLoader runner <tests modificados>`: **20 archivos, 261 pruebas, todos verdes**. Incluye permisos, estados remotos, validación, RPC, cola, aviso confirmado/no confirmado, omisión de contraseña, botones Meta, dueño humano y runtime. Se repitieron únicamente subconjuntos tras corregir problemas durante la iteración.
- `npx eslint --max-warnings=0 <archivos modificados>`: **pasa, cero errores y warnings**.
- `npm run design:check`: **pasa, sin violaciones; ejecutado una sola vez**.
- `npm run typecheck`: **falló en el paso de app por seis usos de `abortSignal` después de `single` / `maybeSingle`**. Se corrigió el orden para el contrato instalado de Supabase y pasaron las regresiones afectadas (31 pruebas en 5 archivos). No se repitió TypeScript por el límite expreso de una ejecución; `typecheck:tests` no llegó a ejecutarse. El estado final de tipos requiere una nueva ejecución autorizada.
- No se ejecutaron quality:fast/full, build, cobertura, DB/integración, E2E, comandos de migración ni acciones contra bases remotas. No hubo commit, push ni despliegue. Se mantuvo el enlace de node_modules y solo se editó este worktree.

## Riesgos y seguimiento

- SQL, RLS, concurrencia y grants requieren validación real desde cero/DB/integración en un entorno autorizado; las pruebas actuales verifican contratos y adaptadores, no ejecutan PostgreSQL.
- No hay navegador conectado. Quedan pendientes la comparación visual con Ventas al paginar/cambiar pestañas, temas claro/oscuro, móvil, accesibilidad y rendimiento. La ruta de design-lab permite hacer esa revisión sin datos remotos.
- Tomar un chat anterior requiere una versión publicada del bot; sin ella el RPC devuelve false y la UI informa un error. Un envío ya en curso antes de tomar el chat puede terminar; el control inhibe los siguientes mensajes procesados por el bot, no los avisos operativos explícitos.
- Solo Netflix está registrado como proveedor de códigos y el botón reutiliza su flujo existente. Agregar proveedores implica registrar su adaptador y ampliar el enrutamiento de solicitud, como indica la documentación de code-providers.
- La entrega fuera de 24h depende de la plantilla aprobada descrita arriba y del bot publicado/activado para responder la solicitud. El fallback manual no ofrece botones interactivos: invita a escribir «código».
- Seguimientos opcionales: push admin al superar un umbral de demanda y eventos de `whatsapp_bot_events` dentro del timeline. La actividad sigue disponible en la pantalla existente del Bot.
- No se midió cobertura ni se completaron los gates de PR/release, por restricción expresa de comandos. TypeScript final y typecheck de tests quedan pendientes después de la corrección descrita.

## Archivos modificados

- `src/app/api/whatsapp/webhook/bot-runtime.ts`
- `src/application/use-cases/bot-reply.ts`
- `src/application/use-cases/send-notice-use-case.test.ts`
- `src/application/use-cases/send-notice-use-case.ts`
- `src/application/use-cases/whatsapp-bot-use-case.test.ts`
- `src/application/use-cases/whatsapp-bot-use-case.ts`
- `src/components/chats/ChatHeader.tsx`
- `src/components/chats/ChatPanels.test.tsx`
- `src/components/chats/ChatWorkspace.test.tsx`
- `src/components/layout/sidebar-navigation.test.ts`
- `src/components/layout/sidebar-navigation.ts`
- `src/components/servicios/ServicioForm.tsx`
- `src/components/servicios/form/ServicioCodeAccessCheckbox.tsx`
- `src/components/servicios/form/useServicioFormController.ts`
- `src/components/servicios/form/useServicioFormSubmit.test.ts`
- `src/components/servicios/form/useServicioFormSubmit.ts`
- `src/modules/messaging/conversation-state-store.test.ts`
- `src/modules/messaging/conversation-state-store.ts`
- `src/modules/whatsapp/bot-menu.test.ts`
- `src/modules/whatsapp/bot-menu.ts`

## Archivos agregados

- `src/app/(dashboard)/catalogo/page.test.tsx`
- `src/app/(dashboard)/catalogo/page.tsx`
- `src/app/(dashboard)/interesados/page.test.tsx`
- `src/app/(dashboard)/interesados/page.tsx`
- `src/app/api/whatsapp/webhook/bot-runtime.test.ts`
- `src/app/design-lab/admin/AdminPreview.test.tsx`
- `src/app/design-lab/admin/AdminPreview.tsx`
- `src/app/design-lab/admin/demo-data.ts`
- `src/app/design-lab/admin/page.tsx`
- `src/application/use-cases/catalog-admin-use-cases.test.ts`
- `src/application/use-cases/catalog-admin-use-cases.ts`
- `src/application/use-cases/conversation-control-use-cases.test.ts`
- `src/application/use-cases/conversation-control-use-cases.ts`
- `src/components/catalog/CatalogConfigEditor.tsx`
- `src/components/catalog/CatalogSettingsEditor.tsx`
- `src/components/catalog/CatalogView.tsx`
- `src/components/catalog/CatalogViews.test.tsx`
- `src/components/catalog/InterestView.tsx`
- `src/components/chats/ConversationControl.test.tsx`
- `src/components/chats/ConversationControl.tsx`
- `src/components/servicios/form/CodeAccessNoticeDialog.test.tsx`
- `src/components/servicios/form/CodeAccessNoticeDialog.tsx`
- `src/hooks/admin-controls.test.tsx`
- `src/hooks/use-catalog-admin.ts`
- `src/hooks/use-code-access-notice.ts`
- `src/hooks/use-conversation-control.ts`
- `src/modules/catalog/admin-contracts.test.ts`
- `src/modules/catalog/admin-contracts.ts`
- `src/platform/supabase/admin-repositories.test.ts`
- `src/platform/supabase/catalog-admin-repository.ts`
- `src/platform/supabase/conversation-control-repository.ts`
- `src/test/catalog-admin-fixtures.ts`
- `supabase/migrations/20261004050000_admin_interest_updates.sql`
- `docs/admin-ui-implementation.md`
