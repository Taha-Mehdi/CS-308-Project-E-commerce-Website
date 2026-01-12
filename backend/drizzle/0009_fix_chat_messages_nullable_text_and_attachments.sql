-- Fix chat schema mismatches introduced by 0008_add_chat_support.sql
--
-- The application inserts messages with NULL text when sending an attachment-only message,
-- and stores attachment metadata (name/mime/size). The original migration made `text` NOT NULL
-- and did not include metadata columns, which breaks uploads and edge cases.

-- 1) Allow attachment-only messages
ALTER TABLE messages
  ALTER COLUMN text DROP NOT NULL;

-- 2) Add attachment metadata fields used by backend/routes/chat.js and frontend widgets
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_mime TEXT,
  ADD COLUMN IF NOT EXISTS attachment_size INTEGER;

-- Optional but recommended indexes for faster queue + message timeline
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
