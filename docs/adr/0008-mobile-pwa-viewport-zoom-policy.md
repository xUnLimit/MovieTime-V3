# ADR-0008: Politica de zoom en PWA movil interna

**Status:** Accepted  
**Date:** 2026-05-30

## Context

MovieTime PTY se usa como herramienta operativa interna/PWA, no como sitio publico de contenido. La interfaz esta optimizada para flujos repetidos de administracion en pantallas moviles y desktop: tablas, formularios, acciones rapidas, sidebar y modales.

Las auditorias web generales suelen recomendar permitir zoom del navegador por accesibilidad. Esa recomendacion es correcta para sitios publicos y productos que buscan compliance WCAG estricto. En una PWA interna, tambien existe un tradeoff de producto: permitir zoom puede generar gestos accidentales, doble-tap zoom, scroll lateral y layouts menos predecibles durante operaciones frecuentes.

## Decision

Mantener el viewport movil con `maximumScale: 1` y `userScalable: false` en los flujos operativos para preservar una experiencia app-like en la PWA interna. La pantalla de acceso permite zoom (`maximumScale: 5` y `userScalable: true`) para cumplir el presupuesto de accesibilidad de Lighthouse.

Esta decision no elimina la responsabilidad de accesibilidad. La compensacion esperada es mantener:

- tipografia legible sin depender de zoom manual;
- tap targets suficientemente grandes;
- layouts responsive sin texto truncado;
- contraste adecuado;
- pruebas manuales en telefonos pequenos.

## Consequences

- Las auditorias de los flujos operativos pueden reportar el bloqueo de zoom; es una limitacion de accesibilidad conocida y una decision de producto documentada.
- Si MovieTime pasa a ser un producto publico, multi-cliente, o requiere compliance WCAG formal, este ADR debe reabrirse y probablemente quitar `maximumScale`/`userScalable`.
- Los cambios de UI movil deben evaluarse con mas rigor, porque el usuario no puede compensar un layout denso usando zoom del navegador.

## Alternatives Considered

- **Permitir zoom del navegador:** mejora accesibilidad estandar, pero reduce la sensacion PWA/app-like y puede introducir interacciones accidentales en flujos operativos.
- **Permitir zoom solo en desktop:** no aplica directamente al viewport movil y agrega una politica dificil de verificar.
- **Mantener bloqueo sin documentarlo:** rechazado porque futuras auditorias lo volverian a marcar como deuda sin contexto.
