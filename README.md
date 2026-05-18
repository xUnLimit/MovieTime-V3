# MovieTime PTY

Sistema de gestion de suscripciones de servicios de streaming para Panama. Administra usuarios, servicios, ventas, categorias, metodos de pago, gastos, dashboard financiero y notificaciones de vencimiento.

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
  -> stores Zustand para estado y cache
    -> use-cases para flujos de negocio compuestos
      -> repositorios Supabase
        -> tablas, vistas, RPC y triggers
```

Directorios principales:

| Ruta | Proposito |
|------|-----------|
| `src/app` | Rutas Next.js App Router |
| `src/components` | Componentes de UI por dominio |
| `src/store` | Stores Zustand |
| `src/lib/use-cases` | Casos de uso de negocio |
| `src/lib/supabase` | Cliente, repositorios, mappers y tipos Supabase |
| `src/lib/services` | Servicios de sincronizacion y calculo |
| `supabase/migrations` | Schema, vistas, funciones, triggers y RLS |
| `scripts` | Scripts operativos Supabase |

## Validacion

`npm run migrate:validate` cuenta tablas Supabase y ejecuta `run_all_validations()`. Los reportes aceptables se mantienen codificados en `scripts/validate-supabase-migration.ts`; cualquier otro fallo bloquea con exit code `1`.

## Contexto del dominio

El vocabulario del dominio y las reglas de arquitectura estan en `CONTEXT.md`. Actualizalo cuando cambien conceptos como ventas, servicios, pagos, pronosticos o metricas derivadas.
