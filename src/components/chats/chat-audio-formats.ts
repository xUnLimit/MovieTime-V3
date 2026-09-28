// Formatos que WhatsApp Cloud API acepta, en orden de preferencia.
// WebM se usa si el navegador no ofrece otro formato de grabación.
export const AUDIO_RECORDING_PREFERENCE = ['audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/ogg', 'audio/webm'];

export const AUDIO_EXTENSIONS: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
};
