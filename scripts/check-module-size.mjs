// Uso: node scripts/check-module-size.mjs [--max 300]
// Comprueba modulos de produccion; excepciones requieren razon y ADR existente.
import { checkModuleSize } from './lib/module-size.mjs';

try {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--max')) throw new Error('Uso: --max <entero positivo>.');
  const max = args.length ? Number(args[1]) : 300;
  const offenders = checkModuleSize(process.cwd(), max);
  if (offenders.length) {
    console.error(`Modulos que superan ${max} lineas:`);
    offenders.forEach(({ path, lines }) => console.error(`- ${path}: ${lines} lineas`));
    process.exitCode = 1;
  } else {
    console.log(`Module size passed (maximo ${max} lineas).`);
  }
} catch (error) {
  console.error(`No se pudo validar el tamano de modulos: ${error.message}`);
  process.exitCode = 1;
}
