-- 0009_align_chat_support.sql
-- Align chat schema with app code (safe to run after 0008)

-- 1) Messages.text must be nullable (allow attachment-only messages)
ALTER TABLE messages
  ALTER COLUMN text DROP NOT NULL;

-- 2) Add attachment metadata columns if missing
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_mime TEXT,
  ADD COLUMN IF NOT EXISTS attachment_size INTEGER;

-- 3) Conversations.guest_token length consistency (optional)
-- If guest_token is TEXT already, this is fine; keep as-is.

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
