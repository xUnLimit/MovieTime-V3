/**
 * Reglas de arquitectura de AGENTS.md ("Arquitectura y dominio") como control automatico.
 * Ejecutar con `npm run arch:check`. Todas las reglas son `error`; no hay excepciones listadas.
 *
 * Decisiones:
 * - Los archivos `*.test.*`, `*.spec.*` y `src/test/**` se excluyen de las reglas de capas
 *   (`from.pathNot`): los tests pueden usar interiores del modulo que prueban y utilidades de
 *   prueba. La conducta de produccion es lo que las reglas protegen.
 * - `next/server`, `next/headers` y `next/cache` se permiten en `platform` (codigo de servidor,
 *   sin UI). Se prohiben `react`, `react-dom` y los `next/*` de presentacion.
 * - A otro modulo solo se entra por su `index.ts` publico.
 */

const NO_TESTS = '\\.(test|spec)\\.(ts|tsx)$|^src/test/';
const REACT_UI =
  '^(react|react-dom)(/|$)|^next/(link|image|navigation|dynamic|font|script|head|form|router|og)(/|$)';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'platform-no-application',
      comment: 'src/platform no importa src/application: la infraestructura no depende de la orquestacion.',
      severity: 'error',
      from: { path: '^src/platform/', pathNot: NO_TESTS },
      to: { path: '^src/application/' },
    },
    {
      name: 'platform-no-modules',
      comment: 'src/platform no importa src/modules: la infraestructura no depende de logica de dominio.',
      severity: 'error',
      from: { path: '^src/platform/', pathNot: NO_TESTS },
      to: { path: '^src/modules/' },
    },
    {
      name: 'platform-no-store',
      comment: 'src/platform no importa @/store: la identidad y el contexto se inyectan desde el composition root.',
      severity: 'error',
      from: { path: '^src/platform/', pathNot: NO_TESTS },
      to: { path: '^src/store/' },
    },
    {
      name: 'platform-no-react-ui',
      comment: 'src/platform no importa React ni next/* de UI (next/server, headers y cache si estan permitidos).',
      severity: 'error',
      from: { path: '^src/platform/', pathNot: NO_TESTS },
      to: { path: REACT_UI },
    },
    {
      name: 'modules-no-application',
      comment: 'src/modules no importa src/application.',
      severity: 'error',
      from: { path: '^src/modules/', pathNot: NO_TESTS },
      to: { path: '^src/application/' },
    },
    {
      name: 'modules-no-store',
      comment: 'src/modules no importa stores.',
      severity: 'error',
      from: { path: '^src/modules/', pathNot: NO_TESTS },
      to: { path: '^src/store/' },
    },
    {
      name: 'modules-no-react-ui',
      comment: 'src/modules no importa React ni next/* de UI.',
      severity: 'error',
      from: { path: '^src/modules/', pathNot: NO_TESTS },
      to: { path: REACT_UI },
    },
    {
      name: 'modules-no-ui-layers',
      comment: 'src/modules no importa componentes, hooks ni rutas de app.',
      severity: 'error',
      from: { path: '^src/modules/', pathNot: NO_TESTS },
      to: { path: '^src/(components|hooks|app)/' },
    },
    {
      name: 'modules-no-foreign-internals',
      comment: 'Un modulo solo importa sus propios archivos y platform; a otro modulo solo por su index.ts publico.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/', pathNot: NO_TESTS },
      to: {
        path: '^src/modules/([^/]+)/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'application-no-store',
      comment: 'src/application no importa stores (la identidad se inyecta).',
      severity: 'error',
      from: { path: '^src/application/', pathNot: NO_TESTS },
      to: { path: '^src/store/' },
    },
    {
      name: 'application-no-ui',
      comment: 'src/application no importa hooks, componentes ni rutas de app.',
      severity: 'error',
      from: { path: '^src/application/', pathNot: NO_TESTS },
      to: { path: '^src/(hooks|components|app)/' },
    },
    {
      name: 'application-no-react',
      comment: 'src/application no importa React ni next/* de UI.',
      severity: 'error',
      from: { path: '^src/application/', pathNot: NO_TESTS },
      to: { path: REACT_UI },
    },
    {
      name: 'store-no-supabase',
      comment: 'src/store no accede a Supabase directamente.',
      severity: 'error',
      from: { path: '^src/store/', pathNot: NO_TESTS },
      to: { path: '^src/platform/supabase/' },
    },
    {
      name: 'ui-no-supabase',
      comment: 'src/app, src/components y src/hooks no llaman Supabase directamente.',
      severity: 'error',
      from: { path: '^src/(app|components|hooks)/', pathNot: NO_TESTS },
      to: { path: '^src/platform/supabase/' },
    },
{      name: 'store-no-supabase-client',      comment: 'src/store no usa @supabase/supabase-js en runtime (los tipos con import type si se permiten).',      severity: 'error',      from: { path: '^src/store/', pathNot: NO_TESTS },      to: { path: '^node_modules/@supabase/', dependencyTypesNot: ['type-only'] },    },    {      name: 'ui-no-supabase-client',      comment: 'src/app, src/components y src/hooks no usan @supabase/supabase-js en runtime (import type permitido).',      severity: 'error',      from: { path: '^src/(app|components|hooks)/', pathNot: NO_TESTS },      to: { path: '^node_modules/@supabase/', dependencyTypesNot: ['type-only'] },    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
    exclude: { path: '^src/.*\\.d\\.ts$' },
  },
};
