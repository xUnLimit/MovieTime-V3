'use client';

import { useState } from 'react';
import { Download, FileText, ImageOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useWhatsAppMedia } from '@/hooks/use-whatsapp-chat';

type MessageAttachmentProps = {
  mediaId: string;
  kind: string;
  mimeType: string | null;
  filename: string | null;
};

const KIND_LABELS: Record<string, string> = {
  image: 'Imagen',
  sticker: 'Sticker',
  audio: 'Audio',
  video: 'Video',
  document: 'Documento',
};

// Las imagenes se cargan al mostrarse (suelen ser comprobantes de pago); el resto
// se descarga solo cuando el usuario lo pide, para no gastar datos en el celular.
export function MessageAttachment({ mediaId, kind, mimeType, filename }: MessageAttachmentProps) {
  const visual = kind === 'image' || kind === 'sticker';
  const [requested, setRequested] = useState(visual);
  const { objectUrl, isLoading, isError } = useWhatsAppMedia(mediaId, requested);
  const label = filename || KIND_LABELS[kind] || 'Archivo';

  if (isError) {
    return (
      <p className="flex items-center gap-2 text-xs opacity-80">
        <ImageOff className="h-4 w-4" aria-hidden /> No se pudo cargar el archivo.
      </p>
    );
  }

  if (!objectUrl) {
    return requested || isLoading ? (
      <div className="flex h-24 w-40 items-center justify-center rounded-md bg-black/10 text-xs opacity-80">Cargando...</div>
    ) : (
      <Button type="button" variant="secondary" size="sm" onClick={() => setRequested(true)}>
        <FileText className="mr-2 h-4 w-4" aria-hidden /> Ver {label.toLowerCase()}
      </Button>
    );
  }

  if (visual) {
    return (
      <a href={objectUrl} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL blob local, next/image no aplica */}
        <img src={objectUrl} alt={kind === 'sticker' ? 'Sticker' : 'Imagen del mensaje'} className="max-h-72 rounded-md object-contain" />
      </a>
    );
  }

  if (kind === 'audio') {
    return <audio controls src={objectUrl} className="max-w-full" aria-label="Audio del mensaje" />;
  }

  if (kind === 'video') {
    return <video controls src={objectUrl} className="max-h-72 max-w-full rounded-md" aria-label="Video del cliente" />;
  }

  return (
    <a
      href={objectUrl}
      download={filename ?? undefined}
      target={mimeType === 'application/pdf' ? '_blank' : undefined}
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 underline underline-offset-2"
    >
      <Download className="h-4 w-4" aria-hidden /> {label}
    </a>
  );
}
