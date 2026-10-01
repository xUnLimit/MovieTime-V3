import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { AUDIO_EXTENSIONS, AUDIO_RECORDING_PREFERENCE } from './chat-audio-formats';

export function useVoiceRecorder(selectFile: (file: File) => void) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  useEffect(() => () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const stopRecording = (keep: boolean) => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorder.onstop = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      if (keep) {
        if (!chunksRef.current.length) {
          toast.error('No se pudo grabar el audio. Intenta de nuevo.');
        } else {
          // El navegador reporta el mime con el codec (p. ej. "audio/webm;codecs=opus");
          // Meta y el endpoint de subida validan el tipo base, sin ese sufijo.
          const baseType = (recorder.mimeType || 'audio/webm').split(';', 1)[0].trim().toLowerCase();
          const extension = AUDIO_EXTENSIONS[baseType] ?? 'webm';
          selectFile(new File(chunksRef.current, `audio-${Date.now()}.${extension}`, { type: baseType }));
        }
      }
      chunksRef.current = [];
    };
    recorder.stop();
    setRecording(false);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Este navegador no permite grabar audio. Prueba abriendo el sitio directamente en Safari.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Se prefieren los formatos que WhatsApp acepta de forma nativa; audio/webm
      // queda como ultimo recurso porque no esta documentado como soportado.
      const mimeType = AUDIO_RECORDING_PREFERENCE.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.start();
      setRecordSeconds(0);
      setRecording(true);
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      toast.error(getPublicErrorMessage(error, 'No se pudo acceder al micrófono.'));
    }
  };

  return { recording, recordSeconds, stopRecording, startRecording };
}
