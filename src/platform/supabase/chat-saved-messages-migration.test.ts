import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20260927233000_chat_saved_messages.sql'), 'utf8');

describe('shared chat messages migration', () => {
  it('keeps messages independent of sales and limits the interactive shape', () => {
    expect(sql).toContain('CREATE TABLE public.chat_saved_messages');
    expect(sql).not.toMatch(/venta_id|tercero_id/i);
    expect(sql).toContain("kind IN ('text', 'buttons', 'list')");
    expect(sql).toContain('jsonb_array_length(options) BETWEEN 1 AND 3');
    expect(sql).toContain('jsonb_array_length(options) BETWEEN 1 AND 10');
    expect(sql).toContain('chat_saved_messages_options_valid CHECK (public.chat_saved_message_options_valid(options, kind))');
    expect(sql).toContain("OR lower(item_title) = ANY(seen_titles)");
  });

  it('shares CRUD only with authenticated admins and protects creator identity', () => {
    expect(sql).toContain('ALTER TABLE public.chat_saved_messages ENABLE ROW LEVEL SECURITY');
    expect((sql.match(/private\.auth_role\(\)\) = 'admin'/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(sql).toContain('created_by = (SELECT auth.uid())');
    expect(sql).toContain('REVOKE ALL ON public.chat_saved_messages FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('GRANT UPDATE (title, kind, body, button_label, options)');
  });
});
