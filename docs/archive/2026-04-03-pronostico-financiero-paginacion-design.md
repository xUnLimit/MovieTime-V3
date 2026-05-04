# Diseno: Navegacion de Pronostico Financiero por bloques de 4 meses

Fecha: 2026-04-03
Componente: `src/components/dashboard/PronosticoFinanciero.tsx`
Hook: `src/hooks/use-pronostico-financiero.ts`

## Objetivo

Permitir navegar el pronostico financiero en bloques de 4 meses, desde el mes actual hasta diciembre del ano actual, manteniendo la UI actual y agregando una animacion de desplazamiento al cambiar de bloque.

## Alcance aprobado

- Extender `usePronosticoFinanciero` con una opcion para calcular meses hasta diciembre del ano actual.
- Mantener compatibilidad con usos existentes del hook (por defecto, 4 meses).
- Agregar controles de navegacion izquierda/derecha en el header de la card.
- Mostrar tarjetas por bloques de 4 meses.
- Actualizar textos:
  - Superior: "Proyecciones de ingresos y gastos para los proximos meses."
  - Inferior: texto contextual sobre estimacion de ingresos, gastos y ganancia.
- Incluir transicion visual en cada cambio de bloque.

## Diseno tecnico

1. Hook con opciones
- Nueva interfaz `UsePronosticoFinancieroOptions`.
- Opcion `endAtCurrentYear` para proyectar desde el mes actual hasta diciembre inclusivo.
- Opcion `monthsCount` para mantener el comportamiento configurable (default 4).
- Dependencias del `useEffect` actualizadas para recalcular cuando cambian las opciones.

2. Paginacion del componente
- `pageSize = 4`.
- `totalPaginas = ceil(meses.length / pageSize)`.
- `mesesVisibles = slice(paginaActual * 4, paginaActual * 4 + 4)`.
- Botones de flecha en el header con deshabilitacion en limites.

3. Animacion
- Animacion sin nuevas dependencias.
- Estado simple de fases: `idle`, `exit`, `enter`.
- Cambio de bloque con desplazamiento horizontal y fade, mediante clases de transform/opacity con transicion corta.

## Riesgos y mitigaciones

- Riesgo: cambios globales del hook.
  - Mitigacion: defaults conservan el comportamiento anterior.
- Riesgo: clicks rapidos durante animacion.
  - Mitigacion: bloqueo de navegacion mientras no este en fase `idle`.

## Validacion

- Build de Next.js sin errores.
- Verificar manualmente:
  - Navegacion por bloques de 4 meses.
  - Limite derecho en diciembre.
  - Textos actualizados.
  - Transicion visual al navegar.
