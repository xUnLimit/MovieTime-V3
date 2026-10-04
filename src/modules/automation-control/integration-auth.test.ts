import { describe, expect, it } from 'vitest';
import { authorizeIntegration } from './integration-auth';
const secret = 'a'.repeat(40);
function request(authorization?: string) {
  return new Request('https://local', { headers: authorization ? { authorization } : {} });
}
describe('scoped integration credential', () => {
  it('accepts only the configured bounded token', () => {
    expect(() => authorizeIntegration(request(`Bearer ${secret}`), secret)).not.toThrow();
    for (const auth of [undefined, 'Basic value', `Bearer ${'b'.repeat(40)}`, `Bearer ${secret}x`, 'Bearer short', `Bearer ${'a'.repeat(257)}`, 'Bearer invalid!']) {
      expect(() => authorizeIntegration(request(auth), secret)).toThrow('Debes iniciar sesión');
    }
  });
  it('fails closed when configuration is absent or malformed', () => {
    for (const configuration of ['', 'short', 'a'.repeat(300), 'a'.repeat(40) + '!']) {
      expect(() => authorizeIntegration(request(`Bearer ${secret}`), configuration)).toThrow('No tienes permisos');
    }
  });
});
