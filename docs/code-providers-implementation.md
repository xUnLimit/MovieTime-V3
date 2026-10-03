# Code Providers y acceso por codigo: informe de implementacion

## Resultado

Registro de proveedores y adaptador Netflix que delega en los parsers existentes, seleccion de proveedor
por categoria y casilla por cuenta en formulario/detalle. Se mantienen las acciones y eventos del bot
publicado y las RPC/reclamos Netflix anteriores. La politica compartida `deliveryPassword` elimina la
contrasena de los avisos, DATOS, mensajes manuales, ventas nuevas y transferencias/actualizaciones.
La documentacion para agregar plataformas esta en `src/modules/code-providers/README.md`.

## Migracion

`supabase/migrations/20261003045000_code_providers.sql` es expand-only:

- `categorias.code_provider` nullable con backfill de nombres Netflix; claves validadas en la aplicacion.
- `servicios.acceso_por_codigo` boolean NOT NULL DEFAULT false.
- Triggers en ambas direcciones para impedir cuentas habilitadas sin proveedor; bloquean la fila de categoria.
  Las funciones SECURITY DEFINER fijan search_path y revocan ejecucion directa.
- `code_claims` con PK(provider, mail_key), RLS, lectura admin, escrituras solo service_role y backfill
  de `netflix_code_claims`; tabla/RPC anteriores sin cambios.
- Columna agregada al FINAL de `v_ventas_full` y `v_servicios_full`; proyecciones originales explicitas
  para evitar que nuevas columnas de las tablas cambien posiciones. Se usa `terceros`, el nombre vigente
  tras el rename anterior de `usuarios`.
- Indicador vigente al final de `v_notificaciones_venta` para mensajes manuales y previews.
- `get_categorias_full` expone el proveedor. RPC invoker `create_servicio_with_code_access` reutiliza
  creacion/pago inicial y guarda el indicador en la misma transaccion, con idempotencia.
- `database.types.ts`: solo adiciones manuales, sin regeneracion ni reordenamiento del contrato previo.

La migracion NO se ejecuto en ninguna base de datos.

## Validacion ejecutada

- `npx.cmd vitest run --configLoader runner <tests afectados>`: **29 archivos, 433 pruebas, todos verdes**.
- Prueba adicional de seleccion de categoria: **1 archivo, 2 pruebas, todas verdes**.
- Tras corregir tipos, regresiones del adaptador/Netflix/bot/categorias: **8 archivos, 166 pruebas,
  todas verdes** (subconjunto de los anteriores).
- Total de pruebas distintas verificadas: **435 en 30 archivos**.
- `npm.cmd run typecheck`: ejecutado **una sola vez**, fallo en el retorno de formatDelivery,
  inferencia de perfiles/providerKey y una propiedad incorrecta en el mapper de categorias.
  Se corrigieron los tres problemas sin casts y se repitieron sus pruebas; **typecheck no se repitio**
  por el limite expreso del usuario. `typecheck:tests` no llego a ejecutarse porque fallo el paso de app.
- `git diff --check`: sin errores de whitespace.

Se uso configLoader runner porque el cargador predeterminado intenta escribir archivos temporales dentro
del node_modules enlazado, fuera del worktree autorizado. No se cambio ni elimino ese enlace.
No se ejecutaron quality:fast/full, cobertura, lint, build, E2E ni comandos de base de datos.
No hubo commit, push ni despliegue.

## Riesgos y trabajo posterior

- El estado final de TypeScript no esta verificado; hace falta una nueva ejecucion autorizada del gate.
- SQL/RLS/concurrencia se revisaron mediante contratos estaticos; pendientes de migraciones desde cero,
  test:db/integracion y los gates completos antes de aprobar un PR.
- No se verifico la UI en navegador, accesibilidad ni rendimiento con E2E.
- Netflix sigue usando sus reclamos legacy durante expand; el backfill de code_claims es una fotografia.
  Sincronizar/reconciliar antes de cambiar consumidores o ejecutar contract.
- Solo Netflix esta registrado. Para plataformas futuras conectar el mailbox desde el composition root,
  conservando la orquestacion compartida. No se agregaron proveedores ficticios, boton de solicitud ni
  aviso masivo al cambiar la casilla.

## Archivos creados

- `docs/code-providers-implementation.md`
- `src/components/categorias/form/CategoryCodeProviderSelect.tsx`
- `src/components/servicios/form/ServicioCodeAccessCheckbox.test.tsx`
- `src/components/servicios/form/ServicioCodeAccessCheckbox.tsx`
- `src/components/servicios/form/ServicioDatosBasicosSection.test.tsx`
- `src/modules/code-providers/README.md`
- `src/modules/code-providers/code-providers.test.ts`
- `src/modules/code-providers/index.ts`
- `src/modules/code-providers/netflix-provider.ts`
- `src/modules/code-providers/types.ts`
- `src/modules/netflix/index.ts`
- `src/platform/supabase/code-providers-contract.test.ts`
- `src/platform/utils/code-access.test.ts`
- `src/platform/utils/code-access.ts`
- `supabase/migrations/20261003045000_code_providers.sql`

## Archivos modificados

- `src/app/(dashboard)/servicios/detalle/[id]/components/ServicioSummaryCards.tsx`
- `src/application/use-cases/categorias-use-cases.test.ts`
- `src/application/use-cases/categorias-use-cases.ts`
- `src/application/use-cases/netflix-code-flow.ts`
- `src/application/use-cases/notice-reply-use-case.test.ts`
- `src/application/use-cases/servicios/servicios-shared.ts`
- `src/application/use-cases/servicios/servicios-write-use-cases.test.ts`
- `src/application/use-cases/servicios/servicios-write-use-cases.ts`
- `src/application/use-cases/whatsapp-chat-use-cases.test.ts`
- `src/application/use-cases/whatsapp-chat-use-cases.ts`
- `src/application/ventas/ventas-read-adapter.ts`
- `src/components/categorias/CategoriaForm.tsx`
- `src/components/categorias/form/categoria-form-helpers.test.ts`
- `src/components/categorias/form/categoria-form-helpers.ts`
- `src/components/categorias/form/useCategoriaFormSubmit.ts`
- `src/components/servicios/ServicioForm.tsx`
- `src/components/servicios/form/ServicioDatosBasicosSection.tsx`
- `src/components/servicios/form/ServicioDatosTab.tsx`
- `src/components/servicios/form/ServicioSeguridadSection.tsx`
- `src/components/servicios/form/servicio-form-helpers.test.ts`
- `src/components/servicios/form/servicio-form-helpers.ts`
- `src/components/servicios/form/servicio-form-schema.ts`
- `src/components/servicios/form/useServicioFormController.ts`
- `src/components/servicios/form/useServicioFormSubmit.ts`
- `src/components/ventas/form/create/venta-create-controller-helpers.test.ts`
- `src/components/ventas/form/create/venta-create-controller-helpers.ts`
- `src/modules/messaging/bot-store.test.ts`
- `src/modules/messaging/bot-store.ts`
- `src/modules/messaging/message-data.test.ts`
- `src/modules/messaging/message-data.ts`
- `src/modules/messaging/notice-store.test.ts`
- `src/modules/messaging/notice-store.ts`
- `src/platform/supabase/categorias-repository.ts`
- `src/platform/supabase/database.types.ts`
- `src/platform/supabase/domain-read-adapters.test.ts`
- `src/platform/supabase/domain-read-adapters.ts`
- `src/platform/supabase/notifications-repository.test.ts`
- `src/platform/supabase/notifications-repository.ts`
- `src/platform/supabase/read-models.ts`
- `src/platform/supabase/servicios-rpc-adapter.test.ts`
- `src/platform/supabase/servicios-rpc-adapter.ts`
- `src/platform/utils/credentialNotification.test.ts`
- `src/platform/utils/credentialNotification.ts`
- `src/types/categorias.ts`
- `src/types/servicios.ts`
- `src/types/ventas.ts`
