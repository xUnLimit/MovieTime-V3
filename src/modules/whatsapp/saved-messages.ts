import { z } from '@/platform/validation/zod';
import { INTERACTIVE_LIMITS } from './interactive-limits';

const optionSchema = z.object({ title: z.string(), description: z.string() });
const draftSchema = z.object({
  title: z.string(),
  kind: z.enum(['text', 'buttons', 'list']),
  body: z.string(),
  buttonLabel: z.string(),
  options: z.array(optionSchema),
});

export type SavedMessageDraft = z.infer<typeof draftSchema>;
type SavedMessageInput = SavedMessageDraft;
export type SavedMessage = SavedMessageInput & {
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

const storedSchema = draftSchema.omit({ buttonLabel: true }).extend({
  id: z.string().uuid(),
  buttonLabel: z.string().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type ValidationResult = { ok: true; value: SavedMessageInput } | { ok: false; error: string };

export function emptySavedMessageDraft(): SavedMessageDraft {
  return { title: '', kind: 'text', body: '', buttonLabel: 'Ver opciones', options: [{ title: '', description: '' }] };
}

export function validateSavedMessageDraft(input: unknown): ValidationResult {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Revisa los campos del mensaje.' };

  const { kind } = parsed.data;
  const title = parsed.data.title.trim();
  const body = parsed.data.body.trim();
  if (!title || title.length > 80) return { ok: false, error: 'Escribe un nombre de hasta 80 caracteres.' };
  if (!body) return { ok: false, error: 'Escribe el texto del mensaje.' };
  if (body.length > (kind === 'text' ? 4096 : INTERACTIVE_LIMITS.body)) {
    return { ok: false, error: `El texto admite hasta ${kind === 'text' ? 4096 : INTERACTIVE_LIMITS.body} caracteres.` };
  }
  if (kind === 'text') return { ok: true, value: { title, kind, body, buttonLabel: '', options: [] } };

  const maxOptions = kind === 'buttons' ? INTERACTIVE_LIMITS.maxButtons : INTERACTIVE_LIMITS.maxRows;
  const titleMax = kind === 'buttons' ? INTERACTIVE_LIMITS.buttonTitle : INTERACTIVE_LIMITS.rowTitle;
  const options = parsed.data.options.map((option) => ({
    title: option.title.trim(),
    description: kind === 'list' ? option.description.trim() : '',
  }));
  if (options.length < 1 || options.length > maxOptions) {
    return { ok: false, error: `Agrega entre 1 y ${maxOptions} ${kind === 'buttons' ? 'botones' : 'opciones'}.` };
  }
  if (options.some((option) => !option.title || option.title.length > titleMax)) {
    return { ok: false, error: `Cada ${kind === 'buttons' ? 'botón' : 'opción'} necesita un título de hasta ${titleMax} caracteres.` };
  }
  if (new Set(options.map((option) => option.title.toLocaleLowerCase('es'))).size !== options.length) {
    return { ok: false, error: 'Los títulos de las opciones no pueden repetirse.' };
  }
  if (options.some((option) => option.description.length > INTERACTIVE_LIMITS.rowDescription)) {
    return { ok: false, error: `Cada descripción admite hasta ${INTERACTIVE_LIMITS.rowDescription} caracteres.` };
  }
  const buttonLabel = kind === 'list' ? parsed.data.buttonLabel.trim() : '';
  if (kind === 'list' && (!buttonLabel || buttonLabel.length > INTERACTIVE_LIMITS.listLabel)) {
    return { ok: false, error: `El botón que abre la lista admite entre 1 y ${INTERACTIVE_LIMITS.listLabel} caracteres.` };
  }
  return { ok: true, value: { title, kind, body, buttonLabel, options } };
}

export function parseSavedMessage(row: unknown): SavedMessage {
  const parsed = storedSchema.parse(row);
  const normalized = validateSavedMessageDraft({ ...parsed, buttonLabel: parsed.buttonLabel ?? '' });
  if (!normalized.ok) throw new Error('Invalid stored chat message');
  return {
    ...normalized.value,
    id: parsed.id,
    createdBy: parsed.createdBy,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
  };
}
