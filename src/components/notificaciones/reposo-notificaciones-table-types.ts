import type { NotificacionReposo } from "@/types/notificaciones";

export type ReposoRow = NotificacionReposo & { id: string };

export const ESTADO_REPOSO_OPTIONS = [
  { value: "todos", label: "Todos los estados" },
  { value: "en_proceso", label: "En proceso" },
  { value: "proximo_finalizar", label: "Por finalizar" },
  { value: "completado", label: "Completado" },
];
