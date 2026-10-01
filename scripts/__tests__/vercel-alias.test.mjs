// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { assertDeploymentId, createVercelClient } from '../lib/vercel-alias.mjs';

const TEAM = 'team_1';
const PROJECT = 'prj_1';
const PREVIOUS = 'dpl_previous1';
const STAGED = 'dpl_staged1';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

/** Simula el estado de Vercel: produccion apunta a `production`; las respuestas dependen de la ruta. */
function fakeVercel({ production = PREVIOUS, deployments = {}, failOn = [] } = {}) {
  const state = { production, calls: [] };
  const fetchImpl = vi.fn(async (url, init = {}) => {
    const path = new URL(url).pathname;
    const method = init.method ?? 'GET';
    state.calls.push(`${method} ${path}`);
    if (failOn.some((pattern) => `${method} ${path}`.includes(pattern))) return json({}, 500);

    if (method === 'GET' && path === `/v9/projects/${PROJECT}`) return json({ targets: { production: { id: state.production } } });
    if (method === 'GET' && path.startsWith('/v13/deployments/')) {
      const id = decodeURIComponent(path.split('/').pop());
      const deployment = deployments[id] ?? { id, projectId: PROJECT, ownerId: TEAM, readyState: 'READY' };
      return json(deployment);
    }
    if (method === 'POST' && path.includes('/promote/')) {
      state.production = decodeURIComponent(path.split('/').pop());
      return json({});
    }
    if (method === 'POST' && path.includes('/rollback/')) {
      state.production = decodeURIComponent(path.split('/').pop());
      return json({});
    }
    if (method === 'DELETE' && path.startsWith('/v13/deployments/')) return new Response(null, { status: 200 });
    return json({}, 404);
  });
  return { state, fetchImpl };
}

function client(fake, overrides = {}) {
  return createVercelClient({
    token: 'token',
    teamId: TEAM,
    projectId: PROJECT,
    fetchImpl: fake.fetchImpl,
    delay: async () => {},
    pollIntervalMs: 1,
    pollTimeoutMs: 50,
    ...overrides,
  });
}

describe('assertDeploymentId', () => {
  it('acepta ids dpl_ y rechaza cualquier otra cosa', () => {
    expect(assertDeploymentId('dpl_abc123')).toBe('dpl_abc123');
    expect(() => assertDeploymentId('')).toThrow('Invalid Vercel deployment ID');
    expect(() => assertDeploymentId(undefined)).toThrow('Invalid Vercel deployment ID');
    expect(() => assertDeploymentId('https://evil.example')).toThrow('Invalid Vercel deployment ID');
    expect(() => assertDeploymentId('dpl_abc123\n')).toThrow('Invalid Vercel deployment ID');
    expect(() => assertDeploymentId({ toString: () => 'dpl_abc123' })).toThrow('Invalid Vercel deployment ID');
  });
});

describe('createVercelClient', () => {
  it.each(['promote', 'rollback', 'remove'])('%s rejects log injection IDs from Vercel before mutating', async (operation) => {
    const fake = fakeVercel({ deployments: {
      [STAGED]: { id: 'dpl_staged1\n::error::forged log', projectId: PROJECT, ownerId: TEAM, readyState: 'READY' },
    } });
    await expect(client(fake)[operation](STAGED)).rejects.toThrow('Invalid Vercel deployment ID');
    expect(fake.state.calls.every((call) => call.startsWith('GET '))).toBe(true);
    expect(fake.state.production).toBe(PREVIOUS);
  });

  it('currentProductionId devuelve el despliegue de produccion validado', async () => {
    expect(await client(fakeVercel()).currentProductionId()).toBe(PREVIOUS);
    await expect(client(fakeVercel({ production: 'no-valido' })).currentProductionId()).rejects.toThrow('Invalid Vercel deployment ID');
  });

  it('corta una peticion colgada con el timeout por peticion', async () => {
    const hanging = vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' })));
    }));
    const slow = createVercelClient({ token: 't', teamId: TEAM, projectId: PROJECT, fetchImpl: hanging, requestTimeoutMs: 20 });
    await expect(slow.currentProductionId()).rejects.toThrow('timed out after 20 ms');
  });

  it('propaga errores HTTP de la API con ruta y estado', async () => {
    const fake = fakeVercel({ failOn: ['GET /v9/projects'] });
    await expect(client(fake).currentProductionId()).rejects.toThrow('failed with 500');
  });

  it('promote cambia produccion al despliegue en cola (por URL) y espera a que el destino cambie', async () => {
    const fake = fakeVercel({ deployments: { 'staged-xyz.vercel.app': { id: STAGED, projectId: PROJECT, ownerId: TEAM, readyState: 'READY' } } });
    expect(await client(fake).promote('https://staged-xyz.vercel.app')).toEqual({ status: 'promoted', deploymentId: STAGED });
    expect(fake.state.production).toBe(STAGED);
    expect(fake.state.calls.some((call) => call.startsWith('POST') && call.includes('/promote/'))).toBe(true);
  });

  it('promote no repite la promocion si ya sirve produccion', async () => {
    const fake = fakeVercel({ production: STAGED });
    expect(await client(fake).promote(STAGED)).toEqual({ status: 'already-serving', deploymentId: STAGED });
    expect(fake.state.calls.some((call) => call.startsWith('POST'))).toBe(false);
  });

  it('promote rechaza un despliegue ajeno o no listo', async () => {
    const foreign = fakeVercel({ deployments: { [STAGED]: { id: STAGED, projectId: 'otro', ownerId: TEAM, readyState: 'READY' } } });
    await expect(client(foreign).promote(STAGED)).rejects.toThrow('does not belong');
    const building = fakeVercel({ deployments: { [STAGED]: { id: STAGED, projectId: PROJECT, ownerId: TEAM, readyState: 'BUILDING' } } });
    await expect(client(building).promote(STAGED)).rejects.toThrow('not ready: BUILDING');
  });

  it('promote falla si Vercel acepta el POST pero el destino nunca cambia (fallo parcial)', async () => {
    const fake = fakeVercel();
    fake.fetchImpl.mockImplementation(async (url, init = {}) => {
      const path = new URL(url).pathname;
      if ((init.method ?? 'GET') === 'POST') return json({});
      if (path === `/v9/projects/${PROJECT}`) return json({ targets: { production: { id: PREVIOUS } } });
      return json({ id: STAGED, projectId: PROJECT, ownerId: TEAM, readyState: 'READY' });
    });
    await expect(client(fake).promote(STAGED)).rejects.toThrow('did not point production to dpl_staged1');
  });

  it('recover revierte produccion al despliegue anterior cuando quedo apuntando a otro', async () => {
    const fake = fakeVercel({ production: STAGED });
    expect(await client(fake).recover(PREVIOUS)).toEqual({ status: 'rolled-back', deploymentId: PREVIOUS });
    expect(fake.state.production).toBe(PREVIOUS);
  });

  it('recover no hace nada si produccion ya apunta al despliegue anterior', async () => {
    const fake = fakeVercel({ production: PREVIOUS });
    expect(await client(fake).recover(PREVIOUS)).toEqual({ status: 'already-serving', deploymentId: PREVIOUS });
    expect(fake.state.calls.some((call) => call.startsWith('POST'))).toBe(false);
  });

  it('recover exige un id de despliegue valido (nunca revierte a ciegas)', async () => {
    await expect(client(fakeVercel()).recover('')).rejects.toThrow('Invalid Vercel deployment ID');
  });

  it('remove elimina el despliegue en cola pero nunca el de produccion ni uno protegido', async () => {
    const fake = fakeVercel({ production: PREVIOUS });
    expect(await client(fake).remove(STAGED, [PREVIOUS])).toEqual({ status: 'removed', deploymentId: STAGED });
    expect(fake.state.calls).toContain(`DELETE /v13/deployments/${STAGED}`);

    const serving = fakeVercel({ production: STAGED });
    await expect(client(serving).remove(STAGED)).rejects.toThrow('serves production');
    expect(serving.state.calls.some((call) => call.startsWith('DELETE'))).toBe(false);

    const protectedFake = fakeVercel({ production: 'dpl_other0' });
    await expect(client(protectedFake).remove(STAGED, [STAGED])).rejects.toThrow('protected');
  });

  it('stagedId resuelve el id de un despliegue por URL y rechaza respuestas con id invalido', async () => {
    const fake = fakeVercel({ deployments: { 'staged-xyz.vercel.app': { id: STAGED, projectId: PROJECT, ownerId: TEAM, readyState: 'READY' } } });
    expect(await client(fake).stagedId('https://staged-xyz.vercel.app')).toBe(STAGED);
    const invalid = fakeVercel({ deployments: { 'bad.vercel.app': { id: 'sin-formato', projectId: PROJECT, ownerId: TEAM, readyState: 'READY' } } });
    await expect(client(invalid).stagedId('https://bad.vercel.app')).rejects.toThrow('Invalid Vercel deployment ID');
  });
});
