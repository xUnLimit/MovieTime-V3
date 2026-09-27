import { CloudApiError, type CloudApiConfig } from './cloud-api-client';

const GRAPH_API_VERSION = 'v23.0';
const REQUEST_TIMEOUT_MS = 15_000;
export const MAX_MEDIA_BYTES = 16 * 1024 * 1024;

// Solo se descarga desde los hosts de Meta: evita que una respuesta alterada
// convierta el proxy en un cliente HTTP arbitrario (SSRF).
function isMetaMediaHost(url: URL) {
  return url.protocol === 'https:'
    && (url.hostname === 'lookaside.fbsbx.com' || url.hostname.endsWith('.fbsbx.com') || url.hostname.endsWith('.fbcdn.net'));
}

async function timedFetch(fetchImpl: typeof fetch, url: string, accessToken: string) {
  try {
    return await fetchImpl(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new CloudApiError(null, 'Media request failed');
  }
}

type MediaInfo = { url?: unknown; mime_type?: unknown; file_size?: unknown };

export async function downloadCloudApiMedia(
  config: CloudApiConfig,
  mediaId: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ bytes: ArrayBuffer; mimeType: string }> {
  const infoResponse = await timedFetch(
    fetchImpl,
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(mediaId)}`,
    config.accessToken
  );
  if (!infoResponse.ok) throw new CloudApiError(null, `Media lookup HTTP ${infoResponse.status}`);

  const info = (await infoResponse.json().catch(() => ({}))) as MediaInfo;
  if (typeof info.url !== 'string') throw new CloudApiError(null, 'Media URL missing');
  if (typeof info.file_size === 'number' && info.file_size > MAX_MEDIA_BYTES) {
    throw new CloudApiError(null, 'Media too large');
  }

  let mediaUrl: URL;
  try {
    mediaUrl = new URL(info.url);
  } catch {
    throw new CloudApiError(null, 'Media URL invalid');
  }
  if (!isMetaMediaHost(mediaUrl)) throw new CloudApiError(null, 'Media host not allowed');

  const fileResponse = await timedFetch(fetchImpl, mediaUrl.toString(), config.accessToken);
  if (!fileResponse.ok) throw new CloudApiError(null, `Media download HTTP ${fileResponse.status}`);

  const bytes = await fileResponse.arrayBuffer();
  if (bytes.byteLength > MAX_MEDIA_BYTES) throw new CloudApiError(null, 'Media too large');

  const mimeType = typeof info.mime_type === 'string' ? info.mime_type : 'application/octet-stream';
  return { bytes, mimeType };
}
