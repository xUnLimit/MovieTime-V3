// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  REQUIRED_E2E_VARS,
  buildPlaywrightArgs,
  buildServerEnv,
  missingE2eVars,
  missingE2eVarsMessage,
  resolvePort,
} from '../lib/auth-gate.mjs';

const fullEnv = Object.fromEntries(REQUIRED_E2E_VARS.map((name) => [name, `valor-${name}`]));

describe('missingE2eVars', () => {
  it('no reporta nada cuando el contrato esta completo', () => {
    expect(missingE2eVars(fullEnv)).toEqual([]);
  });

  it('reporta variables ausentes o vacias', () => {
    const env = { ...fullEnv, E2E_ADMIN_EMAIL: '   ', E2E_WHATSAPP_APP_SECRET: undefined };
    delete env.E2E_SUPABASE_URL;
    expect(missingE2eVars(env)).toEqual(['E2E_SUPABASE_URL', 'E2E_ADMIN_EMAIL', 'E2E_WHATSAPP_APP_SECRET']);
  });

  it('el mensaje nombra cada variable faltante', () => {
    expect(missingE2eVarsMessage(['E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'])).toContain('E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD');
  });
});

describe('resolvePort', () => {
  it('usa 3211 por defecto y nunca 3000', () => {
    expect(resolvePort({})).toBe('3211');
  });

  it('acepta un puerto numerico valido y descarta basura', () => {
    expect(resolvePort({ AUTH_GATE_PORT: '4300' })).toBe('4300');
    expect(resolvePort({ AUTH_GATE_PORT: 'abc; rm -rf' })).toBe('3211');
    expect(resolvePort({ AUTH_GATE_PORT: '3000' })).toBe('3211');
  });
});

describe('buildServerEnv', () => {
  it('usa las claves reales de Supabase y el secreto de WhatsApp', () => {
    const env = buildServerEnv({ ...fullEnv, PATH: '/bin' }, 'http://127.0.0.1:3211');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(fullEnv.E2E_SUPABASE_URL);
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(fullEnv.E2E_SUPABASE_ANON_KEY);
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe(fullEnv.E2E_SUPABASE_SERVICE_ROLE_KEY);
    expect(env.WHATSAPP_APP_SECRET).toBe(fullEnv.E2E_WHATSAPP_APP_SECRET);
    expect(env.NEXT_PUBLIC_APP_URL).toBe('http://127.0.0.1:3211');
    expect(env.NODE_ENV).toBe('production');
    expect(env.PATH).toBe('/bin');
  });

  it('respeta las claves de push existentes y rellena placeholders solo si faltan', () => {
    const env = buildServerEnv({ ...fullEnv, PUSH_CRON_SECRET: 'real' }, 'http://127.0.0.1:3211');
    expect(env.PUSH_CRON_SECRET).toBe('real');
    expect(env.VAPID_PRIVATE_KEY).toContain('placeholder');
  });
});

describe('buildPlaywrightArgs', () => {
  it('ejecuta el proyecto authenticated por defecto', () => {
    expect(buildPlaywrightArgs([])).toEqual({ args: ['test', '--project=authenticated'], visual: false });
  });

  it('respeta un --project explicito', () => {
    expect(buildPlaywrightArgs(['--project=chromium', '--grep', '@auth'])).toEqual({
      args: ['test', '--project=chromium', '--grep', '@auth'],
      visual: false,
    });
  });

  it('--visual agrega el proyecto visual y no se pasa a Playwright', () => {
    expect(buildPlaywrightArgs(['--visual', '--update-snapshots'])).toEqual({
      args: ['test', '--project=authenticated', '--project=visual', '--update-snapshots'],
      visual: true,
    });
  });

  it('--project=visual activa las capturas sin bandera adicional', () => {
    expect(buildPlaywrightArgs(['--project=visual'])).toEqual({ args: ['test', '--project=visual'], visual: true });
  });

  it('--visual con --project explicito solo agrega visual', () => {
    expect(buildPlaywrightArgs(['--project=visual', '--visual']).args).toEqual(['test', '--project=visual']);
  });
});
