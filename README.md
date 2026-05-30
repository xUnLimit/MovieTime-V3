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
npm test -- --run
npm run test:coverage
npm run build
npm run migrate:validate
```

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
| `src/store` | Stores Zustand para UI, compatibilidad y fronteras legacy |
| `src/lib/use-cases` | Casos de uso de negocio |
| `src/lib/supabase` | Cliente, repositorios, RPC Adapters, mappers y tipos Supabase |
| `src/lib/store-reactions` | Reacciones de cache/store tras mutaciones |
| `src/lib/services` | Servicios operacionales acotados |
| `supabase/migrations` | Schema, vistas, funciones, triggers y RLS |
| `scripts` | Scripts operativos Supabase |

## CI / CD

`.github/workflows/quality.yml` ejecuta los gates de calidad en cada Pull Request y push a `main`:

- **Job `quality`** (siempre): `secrets:scan` (sobre los archivos cambiados vs la rama base), `lint`, `test:coverage` y `build`. No requiere credenciales reales: el `build` usa placeholders dummy para las variables que `src/config/env.ts` valida en build-time (la build no se conecta a Supabase).
- **Job `supabase-validation`** (condicional): corre `migrate:validate` contra Supabase. Solo se ejecuta si los *secrets* del repo estan configurados; si no, se omite con un aviso en vez de fallar (util para forks).

Secrets opcionales del repositorio (Settings -> Secrets and variables -> Actions) para activar la validacion Supabase y usar credenciales reales en el build:

| Secret | Uso |
|--------|-----|
| `SUPABASE_SERVICE_ROLE_KEY` | `migrate:validate` (server only) |
| `NEXT_PUBLIC_SUPABASE_URL` | `migrate:validate` + build |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `migrate:validate` + build |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL` | build con valores reales (opcional) |

> Recomendado: marcar el job `quality` como *required status check* en la proteccion de la rama `main` para impedir merges con gates en rojo.

## Validacion

`npm run migrate:validate` cuenta tablas Supabase y ejecuta `run_all_validations()`. Los reportes aceptables se mantienen codificados en `scripts/validate-supabase-migration.ts`; cualquier otro fallo bloquea con exit code `1`.

## Contexto del dominio

El vocabulario del dominio y las reglas de arquitectura estan en `CONTEXT.md`. Actualizalo cuando cambien conceptos como ventas, servicios, pagos, pronosticos o metricas derivadas.

En el dominio comercial, la persona o negocio administrado por la app se llama `Tercero`. El nombre fisico `usuarios` puede aparecer en tablas historicas o perfiles de autenticacion/autorizacion; no debe usarse como nombre nuevo para clientes o revendedores.
