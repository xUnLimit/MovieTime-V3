# ADR-0010: Politica de permisos del navegador

**Status:** Accepted  
**Date:** 2026-09-30

## Context

Chats graba notas de voz con `getUserMedia({ audio: true })`. La cabecera global `Permissions-Policy` denegaba el microfono, por lo que el navegador bloqueaba la captura antes de solicitar permiso al usuario.

## Decision

Permitir el microfono solo al propio origen con `microphone=(self)`. Mantener `camera=()` y `geolocation=()`. Las pruebas unitarias fijan el valor de la cabecera y las pruebas de navegador verifican la politica efectiva y la captura de audio.

## Consequences

El navegador puede solicitar permiso de microfono para grabar notas de voz en Chats. Los documentos de otros origenes no reciben ese permiso por la politica; el usuario conserva el control mediante el permiso del navegador.

## Alternatives

- Mantener `microphone=()` impediria grabar notas de voz.
- Permitir el microfono a todos los origenes ampliaria el acceso sin necesidad funcional.
