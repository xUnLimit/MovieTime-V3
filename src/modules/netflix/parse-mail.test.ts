import { describe, expect, it } from 'vitest';
import { parseNetflixMail } from './parse-mail';

const footer = (email: string) =>
  `<span data-testid="footer-disclaimer">Netflix te envio este mensaje a <a href="https://www.netflix.com/browse?g=1" class="hide-link">[${email}]</a> como parte de tu membresia.</span>`;

const loginMail = (code: string, email = 'Cuenta008@Ejemplo.test') =>
  `<html><body><td class="copy h1">Ingresa este codigo</td>
   <td align="left" class="copy lrg-number regular content-padding" style="x: y;"> ${code} </td>
   <a href="https://www.netflix.com/accountaccess?g=1&amp;lkid=A">actividad</a>${footer(email)}</body></html>`;

const verify = 'https://www.netflix.com/account/travel/verify?nftoken=Bgi+v/AB==&amp;messageGuid=abc';
const greeting = (name: string) => `<p>Hola, <span class="break-word" style="x: y;">${name}</span>:</p>`;
const travelMail = (button = verify, email = 'cuenta008@ejemplo.test', profile = 'Perfil Uno') =>
  `<html><body>${greeting(profile)}<a href="https://www.netflix.com/ManageAccountAccess?nftoken=SIGNOUT%2B">cerrar sesion</a>
   <a href="https://www.netflix.com/password?nftoken=PASS">password</a>
   <a class="h5" href="${button}">Obtener codigo</a>${footer(email)}</body></html>`;

describe('parseNetflixMail', () => {
  it('reads the login code and the account it was sent to', () => {
    expect(parseNetflixMail(loginMail('3916'))).toEqual({
      kind: 'login_code', accountEmail: 'cuenta008@ejemplo.test', code: '3916',
    });
  });

  it('accepts longer numeric codes', () => {
    expect(parseNetflixMail(loginMail('123456'))).toMatchObject({ code: '123456' });
  });

  it('returns only the travel verification link, decoded and intact', () => {
    const parsed = parseNetflixMail(travelMail());
    expect(parsed).toEqual({
      kind: 'travel_link', accountEmail: 'cuenta008@ejemplo.test',
      verifyUrl: 'https://www.netflix.com/account/travel/verify?nftoken=Bgi+v/AB==&messageGuid=abc',
      profileName: 'Perfil Uno',
    });
  });

  it('reads the profile that made the travel request, decoded and trimmed', () => {
    expect(parseNetflixMail(travelMail(verify, undefined, '  Mar&iacute;a &amp; Co &lt;1&gt; &quot;x&quot; &#39;y&#39; &apos;z&apos;&nbsp;'))).toMatchObject({
      profileName: 'Mar&iacute;a & Co <1> "x" \'y\' \'z\'',
    });
    expect(parseNetflixMail(travelMail(verify, undefined, 'Ñandú'))).toMatchObject({ profileName: 'Ñandú' });
  });

  it('limits the profile name to 64 characters and takes the first break-word span', () => {
    const long = parseNetflixMail(travelMail(verify, undefined, 'x'.repeat(100)));
    expect(long).toMatchObject({ profileName: 'x'.repeat(64) });
    const two = travelMail(verify, undefined, 'Primero').replace('<a class="h5"', `${greeting('Segundo')}<a class="h5"`);
    expect(parseNetflixMail(two)).toMatchObject({ profileName: 'Primero' });
  });

  it.each(['', '   ', '&nbsp;'])('reports no profile when the name is empty (%j)', (name) => {
    expect(parseNetflixMail(travelMail(verify, undefined, name))).toMatchObject({ profileName: null });
  });

  it('reports no profile when the greeting is missing', () => {
    const html = travelMail().replace(/<p>Hola[^]*?<\/p>/, '');
    expect(parseNetflixMail(html)).toMatchObject({ kind: 'travel_link', profileName: null });
  });

  it('never returns the sign-out or password links', () => {
    const html = travelMail().replace(verify, 'https://www.netflix.com/browse');
    expect(parseNetflixMail(html)).toBeNull();
  });

  it.each([
    'http://www.netflix.com/account/travel/verify?nftoken=A',
    'https://evil.example/account/travel/verify?nftoken=A',
    'https://www.netflix.com.evil.example/account/travel/verify?nftoken=A',
    'https://user@www.netflix.com:444/account/travel/verify?nftoken=A',
    'https://www.netflix.com/account/travel/verify',
    'https://www.netflix.com/account/travel/verify/extra?nftoken=A',
  ])('rejects the unsafe link %s', (link) => {
    expect(parseNetflixMail(travelMail(link))).toBeNull();
  });

  it('falls back to a bracketed address when the footer marker is missing', () => {
    const html = '<td class="lrg-number">1234</td> enviado a [Otra@Ejemplo.test]';
    expect(parseNetflixMail(html)).toEqual({ kind: 'login_code', accountEmail: 'otra@ejemplo.test', code: '1234' });
  });

  it('reports no account when the footer has no address', () => {
    expect(parseNetflixMail('<td class="lrg-number">1234</td>')).toEqual({
      kind: 'login_code', accountEmail: null, code: '1234',
    });
  });

  it.each([
    '', '<html>sin codigo</html>', '<td class="lrg-number">12</td>', '<td class="lrg-number">12ab</td>',
    '<td class="lrg-number">1234567890</td>',
  ])('ignores mail without a usable code: %s', (html) => {
    expect(parseNetflixMail(html)).toBeNull();
  });

  it('ignores oversized messages', () => {
    expect(parseNetflixMail(`${loginMail('3916')}${'x'.repeat(262_144)}`)).toBeNull();
  });

  it('skips malformed links before a valid one', () => {
    const html = `<a href="https://">roto</a>${travelMail()}`;
    expect(parseNetflixMail(html)).toMatchObject({ kind: 'travel_link' });
  });
});
