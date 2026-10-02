export type NetflixMail =
  | { kind: 'login_code'; accountEmail: string | null; code: string }
  | { kind: 'travel_link'; accountEmail: string | null; verifyUrl: string };

const maxSourceLength = 262_144;
const allowedHosts = new Set(['www.netflix.com', 'netflix.com']);
const verifyPath = '/account/travel/verify';

function decodeHref(value: string): string {
  return value.replace(/&amp;/gi, '&');
}

// Only the "Obtener codigo" button may be opened. The same email also carries
// nftoken links that sign devices out or change the password; any other URL is
// never returned, whatever its shape.
function findVerifyUrl(html: string): string | null {
  for (const match of html.matchAll(/href="([^"]{1,4096})"/gi)) {
    const href = decodeHref(match[1]);
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      continue;
    }
    if (url.protocol === 'https:' && allowedHosts.has(url.hostname) && url.port === ''
      && url.pathname === verifyPath && url.searchParams.get('nftoken')) return href;
  }
  return null;
}

// The code sits alone in the "lrg-number" cell, whatever the language.
function findLoginCode(html: string): string | null {
  return /class="[^"]*\blrg-number\b[^"]*"[^>]*>\s*(\d{4,8})\s*</i.exec(html)?.[1] ?? null;
}

// The footer names the account the message was sent to: "[cuenta@dominio.com]".
function findAccountEmail(html: string): string | null {
  const footer = html.indexOf('footer-disclaimer');
  const pattern = /\[([^\s[\]<>@]{1,64}@[^\s[\]<>@]{1,255}\.[^\s[\]<>@]{2,24})\]/;
  const found = (footer >= 0 ? pattern.exec(html.slice(footer)) : null) ?? pattern.exec(html);
  return found ? found[1].toLowerCase() : null;
}

export function parseNetflixMail(html: string): NetflixMail | null {
  if (!html || html.length > maxSourceLength) return null;
  const accountEmail = findAccountEmail(html);
  const verifyUrl = findVerifyUrl(html);
  if (verifyUrl) return { kind: 'travel_link', accountEmail, verifyUrl };
  const code = findLoginCode(html);
  return code ? { kind: 'login_code', accountEmail, code } : null;
}
