export type NetflixMail =
  | { kind: 'login_code'; accountEmail: string | null; code: string }
  | { kind: 'travel_link'; accountEmail: string | null; verifyUrl: string; profileName: string | null };

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

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

// The greeting "Hola, <span class="break-word">PERFIL</span>:" names the Netflix
// profile that made the request.
function findProfileName(html: string): string | null {
  const raw = /<span\b[^>]*\bclass="[^"]*\bbreak-word\b[^"]*"[^>]*>([^<]{1,200})<\/span>/i.exec(html)?.[1];
  if (!raw) return null;
  const name = raw.replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/gi, (_match, entity: string) => entities[entity.toLowerCase()])
    .trim().slice(0, 64).trim();
  return name || null;
}

export function parseNetflixMail(html: string): NetflixMail | null {
  if (!html || html.length > maxSourceLength) return null;
  const accountEmail = findAccountEmail(html);
  const verifyUrl = findVerifyUrl(html);
  if (verifyUrl) return { kind: 'travel_link', accountEmail, verifyUrl, profileName: findProfileName(html) };
  const code = findLoginCode(html);
  return code ? { kind: 'login_code', accountEmail, code } : null;
}
