# MovieTime PTY

Sistema de gestion de suscripciones de servicios de streaming para Panama. Administra terceros, servicios, ventas, categorias, metodos de pago, gastos, dashboard financiero y notificaciones de vencimiento.

## Stack

| Categoria | Tecnologia |
|-----------|------------|
| App | Next.js 16, React 19, TypeScript |
| UI | Tailwind CSS, shadcn/ui, Radix UI |
| Estado | Zustand |
| Formularios | React Hook Form, Zod |
| Backend | Supabase Auth, Postgres, RLS, RPC |
| Tests | Vitest, Testing Library |

## Requisitos

- Node.js 20+
- Proyecto Supabase configurado
- `.env.local` basado en `.env.local.example`

## Variables de entorno

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` es solo para scripts de mantenimiento. No debe exponerse con prefijo `NEXT_PUBLIC_`.

## Comandos

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test -- --run
npm run test:coverage
npm run build
npm run migrate:validate
npm run quality:fast
npm run quality:full
```

`quality:fast` es el ciclo local de desarrollo. `quality:full` es la definicion
obligatoria de terminado y agrega auditorias de dependencias, SAST, cobertura
del diff, build y pruebas Playwright de smoke, accesibilidad y rendimiento.
Las reglas completas estan en [`AGENTS.md`](AGENTS.md) y el criterio de release
en [`docs/PRODUCTION_STANDARD.md`](docs/PRODUCTION_STANDARD.md).

## Arquitectura

La aplicacion usa Supabase como unica fuente de datos. La capa de datos esta organizada asi:

```txt
UI / hooks
  -> React Query para lecturas remotas
  -> stores Zustand para estado UI, compatibilidad y optimismo acotado
  -> use-cases para flujos de negocio compuestos
  -> Adapters/repositorios Supabase tipados
  -> tablas, vistas, RPC y triggers
```

Directorios principales:

| Ruta | Proposito |
|------|-----------|
| `src/app` | Rutas Next.js App Router |
| `src/components` | Componentes de UI por dominio |
| `src/hooks` | Lecturas remotas con React Query + paginacion |
| `src/store` | Estado de UI/auth/PWA/filtros (Zustand) |
| `src/application` | Orquestacion de negocio: use-cases, composition root (client-domain-mutations), store-reactions, activity |
| `src/modules` | Modulos de dominio profundo: payments, notifications, dashboard-read-models, forecasting, executive-push, pwa, services |
| `src/platform` | Infra transversal: supabase, events, cache, observability, errors, config, utils, server |
| `supabase/migrations` | Schema, vistas, funciones, triggers y RLS |
| `scripts` | Scripts operativos Supabase |

## CI / CD

`.github/workflows/quality.yml` ejecuta los gates de calidad en cada Pull Request y push a `main`:

- **Job `quality`:** secretos de todo el repositorio, dependencias sin advisories,
  SAST/lint sin warnings, tipos, seguridad de migraciones, cobertura global y
  del diff, build, Playwright y SBOM.
- **Job `lighthouse`:** presupuestos de rendimiento, accesibilidad y buenas
  practicas sobre la pagina de login.
- **Job `database`:** Supabase limpio, todas las migraciones e invariantes de
  datos y seguridad RLS/RPC.
- **Job `codeql`:** analisis JavaScript/TypeScript y bloqueo de alertas abiertas.

Cuando todos pasan en `main`, `deploy-production.yml` aplica migraciones
forward-only, crea un deployment staged de Vercel, lo valida, lo promueve y
revierte el frontend si la verificacion posterior falla. Configura el environment
`production`, sus secrets y `PRODUCTION_URL` como indica el estandar. Desactiva
en Vercel la asignacion automatica del dominio: solo CI puede promover versiones.

## Validacion

`npm run migrate:validate` cuenta tablas Supabase y ejecuta `run_all_validations()`. Los reportes aceptables se mantienen codificados en `scripts/validate-supabase-migration.ts`; cualquier otro fallo bloquea con exit code `1`.

## Contexto del dominio

El vocabulario del dominio y las reglas de arquitectura estan en `CONTEXT.md`. Actualizalo cuando cambien conceptos como ventas, servicios, pagos, pronosticos o metricas derivadas.

En el dominio comercial, la persona o negocio administrado por la app se llama `Tercero`. El nombre fisico `usuarios` puede aparecer en tablas historicas o perfiles de autenticacion/autorizacion; no debe usarse como nombre nuevo para clientes o revendedores.
