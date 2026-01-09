-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'open', -- open | claimed | closed

  customer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  guest_token TEXT,

  assigned_agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,

  conversation_id INTEGER NOT NULL
    REFERENCES conversations(id) ON DELETE CASCADE,

  sender_role TEXT NOT NULL, -- customer | agent
  sender_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

  text TEXT NOT NULL,
  attachment_url TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
