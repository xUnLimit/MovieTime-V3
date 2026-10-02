import { describe, expect, it } from 'vitest';
import { normalizeProfileName, profileMatches } from './profile-match';

describe('normalizeProfileName', () => {
  it('ignores case, accents and repeated spaces', () => {
    expect(normalizeProfileName('  María   JOSÉ ')).toBe('maria jose');
  });
});

describe('profileMatches', () => {
  it('matches any of the sale profiles regardless of case, accents and spacing', () => {
    expect(profileMatches('MARIA  jose', ['Otro', 'María José'])).toBe(true);
  });

  it('does not match a different or missing profile', () => {
    expect(profileMatches('Pedro', ['Maria'])).toBe(false);
    expect(profileMatches('Maria', [])).toBe(false);
    expect(profileMatches(null, ['Maria'])).toBe(false);
    expect(profileMatches('   ', [' '])).toBe(false);
  });
});
