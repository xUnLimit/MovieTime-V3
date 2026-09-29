'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, ImageOff, Pause, Play } from 'lucide-react';

import { useWhatsAppMedia } from '@/hooks/use-whatsapp-chat';
import { cn } from '@/platform/utils/cn';
import { useInViewOnce } from './use-in-view-once';

type MessageAttachmentProps = {
  mediaId: string;
  kind: string;
  mimeType: string | null;
  filename: string | null;
  onOpenImage?: (objectUrl: string) => void;
};

const KIND_LABELS: Record<string, string> = {
  image: 'Imagen',
  sticker: 'Sticker',
  audio: 'Audio',
  video: 'Video',
  document: 'Documento',
};

const FILE_CARD = 'my-1 flex max-w-64 items-center gap-2.5 rounded-lg bg-black/5 p-2.5 text-left text-inherit no-underline transition-colors hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-white/[0.07] dark:hover:bg-white/[0.12]';

function fileBadgeText(kind: string, mimeType: string | null, filename: string | null) {
  if (mimeType === 'application/pdf' || filename?.toLowerCase().endsWith('.pdf')) return 'PDF';
  if (kind === 'video') return 'VID';
  return 'FILE';
}

function FileBadge({ kind, mimeType, filename }: { kind: string; mimeType: string | null; filename: string | null }) {
  return (
    <span aria-hidden className="grid h-[35px] w-8 shrink-0 place-items-center rounded-md bg-chat-accent text-xs font-semibold text-chat-accent-ink">
      {fileBadgeText(kind, mimeType, filename)}
    </span>
  );
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

// Alturas de barra estables por mensaje: sin analizar el audio real (no hay
// libreria de waveform en el proyecto), se genera una forma seudoaleatoria
// pero fija a partir del propio mediaId, para que no "baile" en cada render.
const WAVEFORM_BARS = 27;
function waveformHeights(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  const heights: number[] = [];
  for (let index = 0; index < WAVEFORM_BARS; index += 1) {
    hash = (hash * 48271) % 2147483647;
    heights.push(30 + (hash % 100) * 0.7);
  }
  return heights;
}

// Reproductor de nota de voz al estilo WhatsApp: boton de reproducir, barras
// de onda que marcan el avance, y el tiempo transcurrido o la duracion total.
function AudioPlayer({ mediaId, objectUrl }: { mediaId: string; objectUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [heights] = useState(() => waveformHeights(mediaId));
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const activeBars = Math.round(progress * WAVEFORM_BARS);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    const onEnd = () => { setPlaying(false); setCurrentTime(0); };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('durationchange', onLoaded);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('durationchange', onLoaded);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else void audio.play();
    setPlaying(!playing);
  };

  const seekTo = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };

  return (
    <div className="my-1 flex w-56 items-center gap-2.5" aria-label="Audio del mensaje">
      <audio ref={audioRef} src={objectUrl} preload="metadata" className="sr-only" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pausar audio' : 'Reproducir audio'}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-chat-accent text-chat-accent-ink transition-colors hover:bg-chat-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          aria-label="Ir a un punto del audio"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            seekTo(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)));
          }}
          className="flex h-6 w-full items-center gap-[2.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {heights.map((height, index) => (
            <span
              key={index}
              aria-hidden
              className={cn('w-[2.5px] shrink-0 rounded-full transition-colors', index < activeBars ? 'bg-chat-accent' : 'bg-chat-quiet/50')}
              style={{ height: `${height}%` }}
            />
          ))}
        </button>
        <span className="mt-0.5 block text-xs tabular-nums text-chat-quiet">
          {formatDuration(playing || currentTime > 0 ? currentTime : duration)}
        </span>
      </div>
    </div>
  );
}

// Las imagenes, stickers y audios se cargan solos, sin que el usuario los
// toque (comprobantes de pago y notas de voz suelen revisarse de inmediato),
// pero solo cuando entran al viewport: bajar de golpe todo el historial al
// abrir el chat pesa en datos moviles, asi que se cargan "perezosamente" a
// medida que se hacen visibles, igual que WhatsApp. Documentos y video
// siguen esperando un toque explicito del usuario.
export function MessageAttachment({ mediaId, kind, mimeType, filename, onOpenImage }: MessageAttachmentProps) {
  const isSticker = kind === 'sticker';
  const visual = kind === 'image' || isSticker;
  const isAudio = kind === 'audio';
  const autoLoads = visual || isAudio;
  const { ref, inView } = useInViewOnce<HTMLDivElement>(autoLoads);
  const [requested, setRequested] = useState(false);
  const effectiveRequested = requested || (autoLoads && inView);
  const { objectUrl, isLoading, isError } = useWhatsAppMedia(mediaId, effectiveRequested);
  const label = filename || KIND_LABELS[kind] || 'Archivo';

  if (isError) {
    return (
      <p className="flex items-center gap-2 text-xs opacity-80">
        <ImageOff className="h-4 w-4" aria-hidden /> No se pudo cargar el archivo.
      </p>
    );
  }

  if (!objectUrl) {
    if (effectiveRequested || isLoading) {
      return isAudio ? (
        <div ref={ref} className="my-1 flex h-9 w-56 items-center gap-2 text-xs text-chat-quiet" role="status">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-chat-raised"><Play className="ml-0.5 h-4 w-4 opacity-40" /></span>
          Cargando audio...
        </div>
      ) : isSticker ? (
        <div ref={ref} className="h-32 w-32 rounded-md bg-black/10" role="status" aria-label="Cargando sticker" />
      ) : (
        <div ref={ref} className="flex h-24 w-40 items-center justify-center rounded-md bg-black/10 text-xs opacity-80">Cargando...</div>
      );
    }
    if (autoLoads) {
      // Aun no entra al viewport: reserva el mismo hueco que tendria cargando,
      // para que el chat no salte de tamaño cuando el observer lo dispare.
      return isAudio ? (
        <div ref={ref} className="my-1 h-9 w-56" aria-hidden />
      ) : isSticker ? (
        <div ref={ref} className="h-32 w-32 rounded-md bg-black/10" aria-hidden />
      ) : (
        <div ref={ref} className="h-24 w-40 rounded-md bg-black/10" aria-hidden />
      );
    }
    return (
      <button type="button" className={FILE_CARD} onClick={() => setRequested(true)} aria-label={`Ver ${label.toLowerCase()}`}>
        <FileBadge kind={kind} mimeType={mimeType} filename={filename} />
        <span className="min-w-0">
          <strong className="block truncate text-xs">{label}</strong>
          <small className="text-xs opacity-75">Toca para abrir</small>
        </span>
      </button>
    );
  }

  if (isSticker) {
    // Los stickers no se abren en grande ni se descargan: se muestran a un
    // tamaño fijo, igual que en WhatsApp, sin importar la resolucion real del archivo.
    // eslint-disable-next-line @next/next/no-img-element -- URL blob local, next/image no aplica
    return <img src={objectUrl} alt="Sticker" className="h-32 w-32 object-contain" />;
  }

  if (visual) {
    return onOpenImage ? (
      <button type="button" onClick={() => onOpenImage(objectUrl)} className="block cursor-zoom-in rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Ver imagen en grande">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL blob local, next/image no aplica */}
        <img src={objectUrl} alt="Imagen del mensaje" className="max-h-72 rounded-md object-contain" />
      </button>
    ) : (
      <a href={objectUrl} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL blob local, next/image no aplica */}
        <img src={objectUrl} alt="Imagen del mensaje" className="max-h-72 rounded-md object-contain" />
      </a>
    );
  }

  if (isAudio) {
    return <AudioPlayer mediaId={mediaId} objectUrl={objectUrl} />;
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
      className={FILE_CARD}
    >
      <FileBadge kind={kind} mimeType={mimeType} filename={filename} />
      <span className="min-w-0">
        <strong className="block truncate text-xs">{label}</strong>
        <small className="inline-flex items-center gap-1 text-xs opacity-75"><Download className="h-3 w-3" aria-hidden /> Descargar</small>
      </span>
    </a>
  );
}
