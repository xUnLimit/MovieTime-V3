# MovieTime PTY — Sistema de Gestión de Suscripciones

Sistema de gestión de suscripciones de servicios de streaming para Panamá. Administra clientes, revendedores, servicios (Netflix, Disney+, etc.), ventas, categorías, métodos de pago y notificaciones automáticas de vencimiento. Integrado con Firebase (Auth + Firestore + Analytics).

---

## Stack Tecnológico

| Categoría | Tecnología | Versión |
|-----------|-----------|---------|
| Framework | Next.js | 16.1.6 |
| Lenguaje | TypeScript | 5.x |
| UI | React | 19.2.3 |
| Estilos | Tailwind CSS | 4.x |
| Componentes | shadcn/ui + Radix UI | Latest |
| Estado | Zustand | 5.0.10 |
| Formularios | React Hook Form + Zod | 7.71.1 / 4.3.6 |
| Backend | Firebase (Auth + Firestore + Analytics) | 12.8.0 |
| Gráficas | Recharts | 3.7.0 |
| Fechas | date-fns | 4.1.0 |
| Testing | Vitest | 4.0.18 |

---

## Requisitos Previos

- Node.js 20+
- Proyecto Firebase con Firestore habilitado (plan Spark es suficiente)

---

## Instalación

```bash
npm install
```

### Variables de entorno (`.env.local`)

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

Las credenciales se obtienen desde la [consola de Firebase](https://console.firebase.google.com/) → Tu proyecto → Configuración del proyecto → "Tu aplicación web".

---

## Comandos

```bash
npm run dev      # Servidor de desarrollo → http://localhost:3000
npm run build    # Build de producción
npm run lint     # ESLint
npm test         # Vitest

# Firebase
firebase deploy --only firestore:rules    # Reglas de Firestore
firebase deploy --only firestore:indexes  # Índices de Firestore
firebase deploy                           # Deploy completo
```

---

## Módulos

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| Dashboard | `/dashboard` | Métricas generales, gráficas, pronóstico financiero |
| Usuarios | `/usuarios` | Clientes y revendedores (colección unificada) |
| Servicios | `/servicios` | Catálogo de servicios de streaming con soporte de perfiles |
| Ventas | `/ventas` | Suscripciones vendidas con historial de pagos |
| Categorías | `/categorias` | Agrupación de servicios con contadores atómicos |
| Métodos de Pago | `/metodos-pago` | Métodos segregados por usuario/servicio |
| Notificaciones | `/notificaciones` | Alertas de vencimiento (ventas y servicios) |
| Editor de Mensajes | `/editor-mensajes` | Plantillas de WhatsApp personalizables |
| Log de Actividad | `/log-actividad` | Historial detallado de operaciones del sistema |

---

## Autenticación

Firebase Authentication. El rol de administrador se determina por el prefijo `admin@` en el email. La sesión persiste en localStorage.

---

## Estructura del Proyecto

```
src/
├── app/(dashboard)/          # Rutas Next.js App Router
│   ├── layout.tsx
│   ├── dashboard/
│   ├── servicios/            # + crear/, [id]/, [id]/editar/, detalle/[id]/
│   ├── usuarios/             # + crear/, [id]/, editar/[id]/
│   ├── ventas/               # + crear/, [id]/, [id]/editar/
│   ├── categorias/           # + crear/, [id]/, [id]/editar/
│   ├── metodos-pago/         # + crear/, [id]/, [id]/editar/
│   ├── notificaciones/
│   ├── editor-mensajes/
│   └── log-actividad/
├── components/
│   ├── layout/               # Header, Sidebar, ThemeProvider, UserMenu
│   ├── dashboard/            # Gráficas y métricas del dashboard
│   ├── servicios/            # Formularios, tablas y métricas de servicios
│   ├── ventas/               # Formularios, tablas y métricas de ventas
│   ├── usuarios/             # Tablas y formularios de usuarios
│   ├── categorias/           # Tablas y formularios de categorías
│   ├── metodos-pago/         # Tablas y formularios de métodos de pago
│   ├── notificaciones/       # Bell, tablas de ventas/servicios próximos
│   ├── editor-mensajes/      # Editor y lista de plantillas WhatsApp
│   ├── log-actividad/        # Timeline y filtros del log
│   ├── shared/               # PagoDialog, ConfirmDialog, MetricCard, DataTable, etc.
│   └── ui/                   # shadcn/ui primitives
├── hooks/
│   ├── useServerPagination.ts
│   ├── useVentasMetrics.ts
│   ├── use-pagos-venta.ts
│   ├── use-pagos-servicio.ts
│   ├── use-ventas-usuario.ts
│   ├── use-ventas-por-usuarios.ts
│   ├── use-ventas-por-categorias.ts
│   ├── use-ingreso-mensual-esperado.ts
│   ├── use-monto-sin-consumir-total.ts
│   ├── use-pronostico-financiero.ts
│   └── use-sidebar.ts
├── lib/
│   ├── firebase/             # auth.ts, config.ts, firestore.ts, pagination.ts
│   ├── services/             # currencyService, notificationSyncService, pagosVentaService,
│   │                         # pagosServicioService, metricsService, dashboardStatsService, ventaSyncService
│   └── utils/                # calculations.ts, whatsapp.ts, analytics.ts, devLogger.ts, activityLogHelpers.ts
├── store/                    # 11 Zustand stores con caché de 5 min TTL
└── types/                    # Tipos TypeScript por módulo
```

---

## Firebase — Colecciones

| Colección | Descripción |
|-----------|-------------|
| `usuarios` | Clientes y revendedores (`tipo: 'cliente' \| 'revendedor'`) |
| `servicios` | Catálogo de servicios de streaming |
| `ventas` | Suscripciones vendidas |
| `pagosVenta` | Historial de pagos de ventas (colección separada) |
| `pagosServicio` | Historial de pagos de servicios |
| `categorias` | Categorías con contadores atómicos |
| `metodosPago` | Métodos de pago (`asociadoA: 'usuario' \| 'servicio'`) |
| `notificaciones` | Alertas de vencimiento generadas por sync diario |
| `templates` | Plantillas de mensajes WhatsApp |
| `activityLog` | Log de actividad del sistema |
| `config` | Configuración global (ej. tasas de cambio) |
| `gastos` | Gastos asociados a servicios |

---

## Características Principales

### Multi-Moneda
Filas individuales en moneda original. Totales agregados en USD.
- Tasas de cambio: `open.er-api.com` (gratuito, sin API key)
- Caché de tasas: 24h en Firestore `config/exchange_rates`

### Notificaciones Automáticas
- Sincronización una vez por día (caché localStorage)
- Ventana de alerta: 7 días antes del vencimiento
- Prioridades: `baja` → `media` (≤7d) → `alta` (≤3d) → `critica` (vencido/hoy)
- Bell en el header con punto pulsante para alertas no leídas

### Servicios Autorrenovables
- Los servicios pueden configurarse para renovarse automáticamente al vencer
- Crea el siguiente pago y actualiza la fecha de vencimiento sin intervención manual

### WhatsApp
- Plantillas personalizables con placeholders dinámicos
- Mensaje editable antes de enviar (los cambios no se guardan en plantillas)
- Links `wa.me` generados automáticamente

### Paginación y Caché
- Tablas con >10 items usan `useServerPagination` (cursor-based, sin `getAll()`)
- Métricas y conteos usan `getCount()` — 0 lecturas de documentos (gratuito en Spark)
- Stores con TTL de 5 minutos y eliminaciones optimistas con rollback

---

## Issues Conocidos

- **`VentaDoc.pagos`** — campo `@deprecated`; usar la colección `pagosVenta`

---

## Documentación

### Referencia activa (`docs/`)

| Tema | Archivo |
|------|---------|
| Arquitectura general | `docs/ARCHITECTURE.md` |
| Diagramas C4 | `docs/C4_DIAGRAMS.md` |
| Guía de inicio rápido | `docs/QUICK_START.md` |
| Guía del desarrollador | `docs/DEVELOPER_GUIDE.md` |
| Paginación y caché | `docs/PAGINATION_AND_CACHE_PATTERN.md` |
| Conversión de monedas | `docs/CURRENCY_CONVERSION_SETUP.md` |
| Configuración Firebase | `docs/FIREBASE_SETUP.md` |
| Monitoreo de lecturas | `docs/FIREBASE_READS_MONITORING.md` |
| Optimizaciones React | `docs/PERFORMANCE_OPTIMIZATIONS.md` |
| Desnormalización | `docs/DENORMALIZATION_ANALYSIS_PROCESS.md` |

### Planes de diseño activos (`docs/plans/`)

| Plan | Archivo |
|------|---------|
| Sistema multi-moneda | `docs/plans/2026-02-12-currency-conversion-design.md` |
| Notificaciones persistentes v2.1 | `docs/plans/2026-02-12-notificaciones-persistentes-design-v2.1.md` |
| Activity log — cambios detallados | `docs/plans/2026-02-13-activity-log-detailed-changes.md` |
| Dashboard — implementación | `docs/plans/2026-02-13-dashboard-implementation-design.md` |
| Dashboard — optimización de métricas | `docs/plans/2026-02-22-dashboard-metrics-optimization-design.md` |
| Netflix Reposo | `docs/plans/2026-03-05-netflix-reposo-design.md` |

### Historial de diseños (`docs/archive/`)

Documentos de diseño de funcionalidades ya implementadas, guardados como referencia histórica.

---

**Versión:** 2.6.0 | **Actualizado:** Mayo 2026
