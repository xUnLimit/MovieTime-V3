# MovieTime PTY

Sistema interno para operar la reventa de suscripciones de streaming en Panama. Lo usan a diario dos operadores, desde desktop y desde el celular como PWA.

Cubre:

- **Operacion:** terceros (clientes y revendedores), servicios (cuentas de proveedor), ventas y sus periodos, renovaciones, reembolsos, cortes y reposo.
- **Finanzas:** pagos de ventas y servicios, gastos, categorias, metodos de pago y un dashboard financiero con pronostico.
- **WhatsApp (Cloud API de Meta):** bandeja de chats en `/chats` que se actualiza en tiempo real con Supabase Realtime (con sondeo lento de respaldo), plantillas aprobadas por Meta, avisos de vencimiento manuales y automaticos con botones de respuesta.
- **Pagos Yappy:** deteccion de avisos de pago por correo (IMAP) en `/pagos-yappy` para conciliarlos.
- **Notificaciones:** vencimientos de ventas y servicios, push web y resumen ejecutivo programado.

El proposito, los usuarios y los principios del producto estan en [`PRODUCT.md`](PRODUCT.md).

## Stack

| Categoria | Tecnologia |
|-----------|------------|
| App | Next.js 16 (App Router), React 19, TypeScript estricto |
| UI | Tailwind CSS v4, shadcn/ui, Radix UI, lucide-react, Recharts, Sonner |
| Datos en cliente | React Query (lecturas remotas), Zustand (estado UI) |
| Formularios | React Hook Form, Zod |
| Backend | Supabase: Auth, Postgres, RLS, RPC, pg_cron y Vault |
| Integraciones | WhatsApp Cloud API, Gmail por IMAP (Yappy), Web Push (VAPID) |
| Pruebas | Vitest, Testing Library, Playwright, axe, Lighthouse |
| Despliegue | Vercel, con promocion solo desde GitHub Actions |

## Requisitos

- Node.js 24 (la version que usa CI)
- Un proyecto Supabase con las migraciones de `supabase/migrations` aplicadas
- `.env.local` creado a partir de [`.env.local.example`](.env.local.example)

## Variables de entorno

`.env.local.example` lista todas las variables y explica cada una. `src/platform/config` las valida con Zod al arrancar.

| Grupo | Variables | Obligatorias |
|---|---|---|
| App | `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ENABLE_SW_DEV` | URL en produccion |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Si |
| Push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_CRON_SECRET` o `CRON_SECRET` | En produccion |
| WhatsApp | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_AUTO_NOTICES_SECRET`, `WHATSAPP_BOT_ENABLED` | Solo para usar WhatsApp |
| Yappy | `YAPPY_IMAP_USER`, `YAPPY_IMAP_PASSWORD`, `YAPPY_SYNC_SECRET` | Solo para detectar pagos |
| Codigos de Netflix | `NETFLIX_IMAP_USER`, `NETFLIX_IMAP_PASSWORD` | Solo para el bot de codigos |

Todas las variables sin prefijo `NEXT_PUBLIC_` son solo de servidor y nunca deben exponerse al navegador.

## Comandos

```bash
npm install
npm run dev            # servidor de desarrollo
npm run quality:fast   # ciclo local: secretos, diseno, lint, tipos y tests
npm run quality:full   # definicion de terminado (igual que CI)
npm run migrate:validate
```

`quality:full` agrega auditorias de dependencias, seguridad de migraciones, cobertura global y del diff, build, y pruebas Playwright de smoke, accesibilidad, rendimiento y Lighthouse. Los demas scripts estan en `package.json` y en [`scripts/README.md`](scripts/README.md).

La primera vez, activa el hook que escanea secretos antes de cada commit:

```bash
git config core.hooksPath .githooks
```

## Arquitectura

Monolito modular. Supabase/Postgres es la fuente de verdad. Las reglas de imports por capa estan en [`AGENTS.md`](AGENTS.md) y las valida `src/platform/architecture-boundaries.test.ts`.

```txt
app / components / hooks   UI, rutas y lecturas con React Query
        |
application                casos de uso y composition root
        |
modules                    dominios profundos
        |
platform                   infraestructura transversal
        |
Supabase / Postgres        tablas, vistas, RPC, triggers, RLS y cron
```

| Ruta | Proposito |
|------|-----------|
| `src/app` | Rutas App Router, layouts y API routes (`/api/whatsapp`, `/api/yappy`, `/api/push`, `/api/health`) |
| `src/components` | Componentes de UI por dominio y compartidos |
| `src/features` | Esquemas de formularios de ventas y servicios |
| `src/hooks` | Lecturas remotas con React Query |
| `src/store` | Estado UI, auth, PWA y filtros (Zustand) |
| `src/application` | Casos de uso, composition root, reacciones y log de actividad |
| `src/modules` | `payments`, `notifications`, `dashboard-read-models`, `forecasting`, `executive-push`, `messaging`, `whatsapp`, `yappy`, `pwa`, `services` |
| `src/platform` | Supabase, eventos, cache, observabilidad, errores, config, validacion y utilidades |
| `src/types` | Tipos de dominio compartidos |
| `supabase/migrations` | Schema, vistas, funciones, triggers, RLS y cron (forward-only) |
| `scripts` | Gates de calidad y scripts operativos |
| `e2e` | Pruebas Playwright |
| `docs` | Guia de desarrollo, estandar de produccion, ADR y documentacion de integraciones |

## CI / CD

`.github/workflows/quality.yml` corre en cada push y Pull Request a `main`:

- **`quality`:** secretos, dependencias sin advisories, SAST/lint sin warnings, tipos, seguridad de migraciones, cobertura global y del diff, build, Playwright y SBOM.
- **`lighthouse`:** presupuestos de rendimiento, accesibilidad y buenas practicas.
- **`database`:** Supabase limpio, todas las migraciones, invariantes de datos y seguridad RLS/RPC.
- **`codeql`:** analisis JavaScript/TypeScript y bloqueo de alertas abiertas.

Cuando todos pasan en `main`, `deploy-production.yml` aplica las migraciones pendientes, crea un deployment staged en Vercel, lo valida, lo promueve y revierte el frontend si la verificacion posterior falla. Los secrets y el procedimiento estan en [`docs/PRODUCTION_STANDARD.md`](docs/PRODUCTION_STANDARD.md).

## Documentacion

El indice completo esta en [`docs/README.md`](docs/README.md). El vocabulario del dominio esta en [`CONTEXT.md`](CONTEXT.md); actualizalo cuando cambien conceptos del negocio.

En el dominio comercial, la persona o negocio administrado se llama `Tercero`. El nombre `usuarios` queda para los perfiles de autenticacion y no se usa para clientes ni revendedores.
