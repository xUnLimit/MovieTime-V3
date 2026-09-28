import { parseSavedMessage, validateSavedMessageDraft, type SavedMessage, type SavedMessageDraft } from '@/modules/whatsapp/saved-messages';
import {
  createChatSavedMessage,
  deleteChatSavedMessage,
  listChatSavedMessages,
  updateChatSavedMessage,
} from '@/platform/supabase/chat-saved-messages-repository';
import { assertUuid } from '@/platform/utils/safety';

export async function listSavedMessagesUseCase(): Promise<SavedMessage[]> {
  const rows = await listChatSavedMessages();
  return rows.map((row) => parseSavedMessage({
    id: row.id,
    title: row.title,
    kind: row.kind,
    body: row.body,
    buttonLabel: row.button_label,
    options: row.options,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveSavedMessageUseCase(draft: SavedMessageDraft, id?: string): Promise<SavedMessage> {
  const result = validateSavedMessageDraft(draft);
  if (!result.ok) throw new Error(result.error);
  const input = {
    title: result.value.title,
    kind: result.value.kind,
    body: result.value.body,
    button_label: result.value.kind === 'list' ? result.value.buttonLabel : null,
    options: result.value.options,
  };
  const row = id
    ? await updateChatSavedMessage(assertUuid(id, 'mensaje guardado'), input)
    : await createChatSavedMessage(input);
  return parseSavedMessage({
    id: row.id,
    title: row.title,
    kind: row.kind,
    body: row.body,
    buttonLabel: row.button_label,
    options: row.options,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function deleteSavedMessageUseCase(id: string): Promise<void> {
  await deleteChatSavedMessage(assertUuid(id, 'mensaje guardado'));
}
