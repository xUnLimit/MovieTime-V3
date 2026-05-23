import { getTemplates } from "@/lib/supabase/templates-repository";
import type { TemplateMensaje } from "@/types";

export function fetchTemplatesUseCase<T = TemplateMensaje>() {
  return getTemplates<T>();
}
