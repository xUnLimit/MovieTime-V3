import { appendFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const API_ORIGIN = 'https://api.vercel.com';
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 180_000;

function requireValue(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const token = requireValue('VERCEL_TOKEN');
const teamId = requireValue('VERCEL_ORG_ID');
const projectId = requireValue('VERCEL_PROJECT_ID');

function withTeam(path) {
  const url = new URL(path, API_ORIGIN);
  url.searchParams.set('teamId', teamId);
  return url;
}

async function vercelRequest(path, init = {}) {
  const response = await fetch(withTeam(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Vercel API ${init.method ?? 'GET'} ${path} failed with ${response.status}`);
  }

  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function getProject() {
  return vercelRequest(`/v9/projects/${encodeURIComponent(projectId)}`);
}

async function getDeployment(reference) {
  const normalized = reference.startsWith('http') ? new URL(reference).hostname : reference;
  const deployment = await vercelRequest(`/v13/deployments/${encodeURIComponent(normalized)}`);

  if (deployment.projectId !== projectId || deployment.ownerId !== teamId) {
    throw new Error('Deployment does not belong to the configured production project');
  }
  if (deployment.readyState !== 'READY') {
    throw new Error(`Deployment is not ready: ${deployment.readyState ?? 'unknown'}`);
  }
  return deployment;
}

async function waitForAliasRequest(expectedDeploymentId, expectedType) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const project = await getProject();
    const request = project.lastAliasRequest;

    if (request?.toDeploymentId === expectedDeploymentId && request.type === expectedType) {
      if (request.jobStatus === 'succeeded') return;
      if (request.jobStatus === 'failed' || request.jobStatus === 'skipped') {
        throw new Error(`Vercel ${expectedType} finished with status ${request.jobStatus}`);
      }
    }
    await delay(POLL_INTERVAL_MS);
  }

  throw new Error(`Vercel ${expectedType} did not finish within ${POLL_TIMEOUT_MS / 1_000} seconds`);
}

async function publishPreviousDeploymentId(deploymentId) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) await appendFile(outputPath, `previous_deployment_id=${deploymentId}\n`, 'utf8');
}

async function promote(reference) {
  const [project, deployment] = await Promise.all([getProject(), getDeployment(reference)]);
  const previousDeploymentId = project.targets?.production?.id;

  if (!previousDeploymentId) throw new Error('Current production deployment could not be determined');
  await publishPreviousDeploymentId(previousDeploymentId);

  if (previousDeploymentId === deployment.id) {
    console.log(`Deployment ${deployment.id} is already serving production`);
    return;
  }

  await vercelRequest(
    `/v10/projects/${encodeURIComponent(projectId)}/promote/${encodeURIComponent(deployment.id)}`,
    { method: 'POST', body: '{}' },
  );
  await waitForAliasRequest(deployment.id, 'promote');
  console.log(`Promoted deployment ${deployment.id}`);
}

async function rollback(reference) {
  const deployment = await getDeployment(reference);
  await vercelRequest(
    `/v9/projects/${encodeURIComponent(projectId)}/rollback/${encodeURIComponent(deployment.id)}`,
    { method: 'POST', body: '{}' },
  );
  await waitForAliasRequest(deployment.id, 'rollback');
  console.log(`Rolled back to deployment ${deployment.id}`);
}

const [action, reference] = process.argv.slice(2);
if (!reference || !['promote', 'rollback'].includes(action)) {
  throw new Error('Usage: node scripts/vercel-production-alias.mjs <promote|rollback> <deployment>');
}

if (action === 'promote') await promote(reference);
else await rollback(reference);
