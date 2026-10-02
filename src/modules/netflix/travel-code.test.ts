import { describe, expect, it } from 'vitest';
import { parseTravelCode } from './travel-code';

describe('parseTravelCode', () => {
  it('reads the code rendered by the verification page', () => {
    const html = '<div class="challenge-code">4003</div><div class="expiration">Este codigo vence</div>';
    expect(parseTravelCode(html)).toBe('4003');
  });

  it('tolerates extra classes and whitespace', () => {
    expect(parseTravelCode('<div class="a challenge-code b" data-x="1"> 123456 </div>')).toBe('123456');
  });

  it.each([
    '', '<div>sin codigo</div>', '<div class="challenge-code">12</div>', '<div class="challenge-code">ab12</div>',
    '<div class="challenge-code">4003</div><div class="challenge-code">9999</div>',
  ])('returns null for an unusable page: %s', (html) => {
    expect(parseTravelCode(html)).toBeNull();
  });

  it('ignores oversized pages', () => {
    expect(parseTravelCode(`<div class="challenge-code">4003</div>${'x'.repeat(1_048_576)}`)).toBeNull();
  });
});
