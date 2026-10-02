const timeoutMs = 8_000;
const maxPageBytes = 1_048_576;
const verifyHost = 'www.netflix.com';
const verifyPath = '/account/travel/verify';

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

function isVerifyUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === verifyHost && url.port === '' && url.username === ''
      && url.password === '' && url.pathname === verifyPath;
  } catch {
    return false;
  }
}

async function readCapped(response: Response): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    bytes += value.byteLength;
    if (bytes > maxPageBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

// Opens the single-use "Obtener codigo" page. A redirect (for example to the
// login page) is never followed: it means the page is not readable from here.
export async function fetchTravelPageHtml(url: string, fetchImpl: FetchLike = fetch): Promise<string | null> {
  if (!isVerifyUrl(url)) return null;
  const response = await fetchImpl(url, {
    redirect: 'manual', signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: 'text/html', 'Accept-Language': 'es-PA,es;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
    },
  });
  if (response.status !== 200) {
    await response.body?.cancel();
    return null;
  }
  return readCapped(response);
}
