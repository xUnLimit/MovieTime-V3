// El navegador en CI ejecuta las tres suites en una sola invocacion.
// Lighthouse en CI usa la accion oficial en vez del wrapper local.
const EQUIVALENCES = Object.freeze({
  'test:e2e': 'test:browser',
  'test:a11y': 'test:browser',
  'test:performance': 'test:browser',
  'test:lighthouse': 'treosh/lighthouse-ci-action',
});

// Estos pasos son exclusivos de CI: evidencia SBOM, pruebas de infraestructura,
// despliegue y comprobaciones adicionales que no forman parte de quality:full.
const CI_ONLY = new Set([
  'sbom', 'env:validate', 'migrate:validate', 'test:browser',
  'test:integration', 'test:db', 'test:mutation', 'test:e2e:auth',
]);

function qualityCommands(script) {
  return [...script.matchAll(/(?:^|&&)\s*npm\s+run\s+([\w:-]+)\s*(?=&&|$)/g)]
    .map((match) => match[1]);
}

function workflowCommands(source) {
  const content = source.split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .map((line) => line.replace(/\s+#.*$/, ''))
    .join('\n');
  return {
    commands: [...content.matchAll(/\bnpm\s+run\s+([\w:-]+)/g)].map((match) => match[1]),
    lighthouse: /\buses:\s*treosh\/lighthouse-ci-action@/.test(content),
  };
}

export function checkCiParity(qualityScript, workflows) {
  const quality = new Set(qualityCommands(qualityScript));
  const parsed = Object.entries(workflows).map(([file, source]) => [file, workflowCommands(source)]);
  const failures = [];

  for (const command of quality) {
    const equivalent = EQUIVALENCES[command] ?? command;
    const present = parsed.some(([, workflow]) => equivalent === 'treosh/lighthouse-ci-action'
      ? workflow.lighthouse : workflow.commands.includes(equivalent));
    if (!present) failures.push(`quality.yml y demas workflows: falta npm run ${command} (equivalencia: ${equivalent}).`);
  }

  for (const [file, workflow] of parsed) {
    for (const command of new Set(workflow.commands)) {
      if (quality.has(command) || CI_ONLY.has(command)) continue;
      if (Object.values(EQUIVALENCES).includes(command)) continue;
      failures.push(`${file}: npm run ${command} no figura en quality:full ni en los exclusivos de CI.`);
    }
  }
  return failures;
}
