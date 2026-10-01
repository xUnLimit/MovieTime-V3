import { setTimeout as sleep } from 'node:timers/promises';

const DEFAULTS = {
  apiOrigin: 'https://api.vercel.com',
  pollIntervalMs: 2_000,
  pollTimeoutMs: 180_000,
  // Limite por peticion: el plazo del sondeo solo se evalua entre peticiones y no corta un fetch colgado.
  requestTimeoutMs: 15_000,
};

export function assertDeploymentId(value) {
  if (typeof value !== 'string' || !/^dpl_[A-Za-z0-9]+$/.test(value)) throw new Error('Invalid Vercel deployment ID');
  return value;
}

/**
 * Cliente minimo de la API de Vercel para promover, revertir, recuperar y limpiar despliegues.
 * Recibe `fetchImpl`, `delay` y los plazos para poder probarlo sin red ni esperas reales.
 */
export function createVercelClient({ token, teamId, projectId, fetchImpl = fetch, delay = sleep, ...overrides }) {
  const config = { ...DEFAULTS, ...overrides };

  function withTeam(path) {
    const url = new URL(path, config.apiOrigin);
    url.searchParams.set('teamId', teamId);
    return url;
  }

  async function request(path, init = {}) {
    const method = init.method ?? 'GET';
    let response;
    try {
      response = await fetchImpl(withTeam(path), {
        ...init,
        signal: AbortSignal.timeout(config.requestTimeoutMs),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new Error(`Vercel API ${method} ${path} timed out after ${config.requestTimeoutMs} ms`);
      }
      throw error;
    }

    if (!response.ok) {
      throw new Error(`Vercel API ${method} ${path} failed with ${response.status}`);
    }

    const body = await response.text();
    return body ? JSON.parse(body) : null;
  }

  const getProject = () => request(`/v9/projects/${encodeURIComponent(projectId)}`);

  async function loadDeployment(reference, { requireReady = true } = {}) {
    const normalized = reference.startsWith('http') ? new URL(reference).hostname : reference;
    const deployment = await request(`/v13/deployments/${encodeURIComponent(normalized)}`);
    assertDeploymentId(deployment?.id);

    if (deployment.projectId !== projectId || deployment.ownerId !== teamId) {
      throw new Error('Deployment does not belong to the configured production project');
    }
    if (requireReady && deployment.readyState !== 'READY') {
      throw new Error(`Deployment is not ready: ${deployment.readyState ?? 'unknown'}`);
    }
    return deployment;
  }

  async function waitForProductionDeployment(expectedDeploymentId, operation) {
    const deadline = Date.now() + config.pollTimeoutMs;

    while (Date.now() < deadline) {
      const project = await getProject();
      if (project.targets?.production?.id === expectedDeploymentId) return;
      await delay(config.pollIntervalMs);
    }

    throw new Error(
      `Vercel ${operation} did not point production to ${expectedDeploymentId} within ${config.pollTimeoutMs / 1_000} seconds`,
    );
  }

  async function currentProductionId() {
    const project = await getProject();
    return assertDeploymentId(project.targets?.production?.id ?? '');
  }

  async function stagedId(reference) {
    return assertDeploymentId((await loadDeployment(reference)).id);
  }

  async function promote(reference) {
    const [project, deployment] = await Promise.all([getProject(), loadDeployment(reference)]);
    const previousDeploymentId = project.targets?.production?.id;

    if (!previousDeploymentId) throw new Error('Current production deployment could not be determined');
    if (previousDeploymentId === deployment.id) return { status: 'already-serving', deploymentId: deployment.id };

    await request(
      `/v10/projects/${encodeURIComponent(projectId)}/promote/${encodeURIComponent(deployment.id)}`,
      { method: 'POST', body: '{}' },
    );
    await waitForProductionDeployment(deployment.id, 'promote');
    return { status: 'promoted', deploymentId: deployment.id };
  }

  async function rollback(reference) {
    const [project, deployment] = await Promise.all([getProject(), loadDeployment(reference)]);

    if (project.targets?.production?.id === deployment.id) return { status: 'already-serving', deploymentId: deployment.id };

    await request(
      `/v1/projects/${encodeURIComponent(projectId)}/rollback/${encodeURIComponent(deployment.id)}`,
      { method: 'POST', body: '{}' },
    );
    await waitForProductionDeployment(deployment.id, 'rollback');
    return { status: 'rolled-back', deploymentId: deployment.id };
  }

  /**
   * Recuperacion basada en el destino REAL de produccion: sirve tras una promocion fallida o parcial
   * (POST aceptado pero sondeo agotado) y tras una verificacion posterior fallida.
   */
  async function recover(previousDeploymentId) {
    assertDeploymentId(previousDeploymentId);
    const project = await getProject();
    if (project.targets?.production?.id === previousDeploymentId) {
      return { status: 'already-serving', deploymentId: previousDeploymentId };
    }
    return rollback(previousDeploymentId);
  }

  /** Elimina un despliegue en cola (staged) que nosotros creamos; nunca el que sirve produccion. */
  async function remove(reference, protectedIds = []) {
    const deployment = await loadDeployment(reference, { requireReady: false });
    const project = await getProject();

    if (project.targets?.production?.id === deployment.id) {
      throw new Error('Refusing to delete the deployment that serves production');
    }
    if (protectedIds.filter(Boolean).includes(deployment.id)) {
      throw new Error('Refusing to delete a protected deployment');
    }

    await request(`/v13/deployments/${encodeURIComponent(deployment.id)}`, { method: 'DELETE' });
    return { status: 'removed', deploymentId: deployment.id };
  }

  return { currentProductionId, stagedId, promote, rollback, recover, remove, getProject };
}
