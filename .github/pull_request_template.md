## Que cambia y por que

<!-- Una o dos frases. Enlaza el hallazgo o la tarea si existe. -->

## Verificacion

- [ ] `npm run quality:full` pasa en un checkout limpio (o explico abajo que parte no pude correr y por que)
- [ ] El comportamiento nuevo y la regresion relevante tienen pruebas (unitarias; integracion/e2e si toca ventas, servicios, pagos, renovaciones, RLS o rollback)
- [ ] No baje umbrales, no omiti pruebas y no agregue excepciones (cobertura, ESLint, Knip, arquitectura, tamano de modulos)

## Riesgo

- [ ] Si hay migracion: es forward-only, compatible con la version anterior de la app y no edita migraciones existentes
- [ ] Si toca autorizacion, pagos o reembolsos: hay prueba contra Postgres real o justifico por que no
- [ ] Si agrega una dependencia: explico la razon y paso `security:audit:prod` y `security:audit:all`
- [ ] Si toca UI: cumple `DESIGN.md` (`npm run design:check`) y revise la tabla/pantalla en el navegador

## Notas para quien revisa

<!-- Decisiones, alternativas descartadas, partes que merecen lectura linea a linea. -->
