import { assertDeploymentId, createVercelClient } from './lib/vercel-alias.mjs';

const USAGE = [
  'Usage: node scripts/vercel-production-alias.mjs',
  '  current                         # id del despliegue que sirve produccion',
  '  id <deployment>                 # id (dpl_...) de un despliegue por URL o id',
  '  promote <deployment>            # promueve el despliegue en cola',
  '  rollback <deployment>           # devuelve produccion a un despliegue',
  '  recover <previous-id>           # si produccion no apunta a previous-id, la revierte',
  '  remove <deployment> [protected] # elimina un despliegue en cola (nunca el de produccion)',
].join('\n');

function requireValue(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const client = createVercelClient({
  token: requireValue('VERCEL_TOKEN'),
  teamId: requireValue('VERCEL_ORG_ID'),
  projectId: requireValue('VERCEL_PROJECT_ID'),
});

const [action, reference, extra] = process.argv.slice(2);

if (action === 'current') {
  console.log(await client.currentProductionId());
} else if (!reference) {
  throw new Error(USAGE);
} else if (action === 'id') {
  console.log(await client.stagedId(reference));
} else if (action === 'promote') {
  const result = await client.promote(reference);
  console.log(result.status === 'already-serving'
    ? `Deployment ${result.deploymentId} is already serving production`
    : `Promoted deployment ${result.deploymentId}`);
} else if (action === 'rollback') {
  const result = await client.rollback(reference);
  console.log(result.status === 'already-serving'
    ? `Deployment ${result.deploymentId} is already serving production`
    : `Rolled back to deployment ${result.deploymentId}`);
} else if (action === 'recover') {
  const result = await client.recover(assertDeploymentId(reference));
  console.log(result.status === 'already-serving'
    ? `Production already serves ${result.deploymentId}: nothing to recover`
    : `Recovered production to ${result.deploymentId}`);
} else if (action === 'remove') {
  const result = await client.remove(reference, extra ? [extra] : []);
  console.log(`Removed staged deployment ${result.deploymentId}`);
} else {
  throw new Error(USAGE);
}
