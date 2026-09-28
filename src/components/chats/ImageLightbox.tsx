'use client';

import { useEffect } from 'react';
import { Download, X } from 'lucide-react';

type ImageLightboxProps = {
  src: string;
  alt: string;
  filename?: string | null;
  onClose: () => void;
};

// Visor de imagen sobre el propio chat, sin salir a otra pestaña. Cierra con
// Escape o clic fuera de la imagen, como el visor nativo de WhatsApp Web.
export function ImageLightbox({ src, alt, filename, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Imagen del mensaje"
      className="fixed inset-0 z-[120] flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex items-center justify-end gap-1 p-3">
        <a
          href={src}
          download={filename ?? undefined}
          onClick={(event) => event.stopPropagation()}
          className="grid h-10 w-10 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Descargar imagen"
        >
          <Download className="h-5 w-5" aria-hidden />
        </a>
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onClose(); }}
          className="grid h-10 w-10 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL blob local, next/image no aplica */}
        <img
          src={src}
          alt={alt}
          onClick={(event) => event.stopPropagation()}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        />
      </div>
    </div>
  );
}
