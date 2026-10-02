const maxPageLength = 1_048_576;

// The verification page renders the code server side inside "challenge-code".
// More than one match means the layout changed, so nothing is trusted.
export function parseTravelCode(html: string): string | null {
  if (!html || html.length > maxPageLength) return null;
  const found = [...html.matchAll(/class="[^"]*\bchallenge-code\b[^"]*"[^>]*>\s*(\d{4,8})\s*</gi)];
  return found.length === 1 ? found[0][1] : null;
}
