# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dos operadores del negocio (el dueño y una persona más) que administran la reventa de suscripciones de streaming en Panamá. Usan el sistema a diario desde desktop y desde el celular (instalado como PWA): revisar vencimientos, cobrar, renovar, pagar proveedores y atender clientes por WhatsApp.

## Product Purpose

MovieTime PTY gestiona terceros (clientes y revendedores), servicios (cuentas/perfiles de proveedor), ventas y sus periodos, pagos, gastos, categorías, métodos de pago, notificaciones de vencimiento, chats de WhatsApp, plantillas de mensajes y un dashboard financiero con pronóstico. El éxito es operar rápido y sin errores: saber qué vence, qué cobrar y cuánto se gana.

## Operating Context

- Sesiones cortas y repetidas durante el día; muchas desde el teléfono.
- Flujos clave: crear/renovar venta, registrar pago (incluido Yappy), cortar o pausar (reposo), responder chats, enviar avisos de vencimiento.
- Soporte offline de solo lectura (PWA); las mutaciones requieren conexión.

## Capabilities and Constraints

- Next.js 16, React 19, Tailwind v4, shadcn/ui (Radix), lucide-react, recharts, sonner.
- Reglas de ingeniería canónicas en `AGENTS.md` (módulos < 300 líneas, sin dependencias sin justificación, `quality:full` como definición de terminado).
- Idioma de la interfaz: español.
- Todos los apartados y su contenido actual deben mantenerse en cualquier rediseño.

## Brand Commitments

- Nombre: **MovieTime PTY** (intocable).
- Logo: la "M" actual (`public/logo.svg`, `src/app/icon.tsx`) (intocable).
- Color de marca: violeta (oklch hue ~295) (intocable).
- Orientación visual pedida por el usuario: estilo Vercel/Geist, limpio y elegante; claro y oscuro igual de pulidos; densidad media.

## Product Principles

1. Operar primero: cada pantalla abre con datos o acciones útiles.
2. Consistencia sobre creatividad local: un componente por patrón.
3. El estado nunca se comunica solo con color.
4. Igual de usable en el celular que en desktop.

## Accessibility & Inclusion

WCAG 2 AA (gate de axe sin impactos serios/críticos; Lighthouse accesibilidad ≥ 0.95).
