-- Juggerknocker Invitational — Message Board Tables
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)

-- Thread table
CREATE TABLE IF NOT EXISTS mb_threads (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year           int NOT NULL,
  category       text NOT NULL,
  title          text NOT NULL,
  author         text NOT NULL,          -- username
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_reply_at  timestamptz NOT NULL DEFAULT now(),
  reply_count    int NOT NULL DEFAULT 0,
  is_pinned      boolean NOT NULL DEFAULT false,
  is_locked      boolean NOT NULL DEFAULT false
);

-- Post table
CREATE TABLE IF NOT EXISTS mb_posts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  uuid NOT NULL REFERENCES mb_threads(id) ON DELETE CASCADE,
  year       int NOT NULL,
  is_op      boolean NOT NULL DEFAULT false,
  author     text NOT NULL,              -- username
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at  timestamptz,
  is_deleted boolean NOT NULL DEFAULT false
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS mb_threads_year_idx ON mb_threads (year, last_reply_at DESC);
CREATE INDEX IF NOT EXISTS mb_posts_thread_idx ON mb_posts (thread_id, created_at);

-- Enable Row Level Security (optional but recommended)
-- ALTER TABLE mb_threads ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE mb_posts   ENABLE ROW LEVEL SECURITY;
-- For now, keep open (anon key already scopes to the project).

-- Enable realtime for live updates (optional — board currently polls on mount)
-- ALTER PUBLICATION supabase_realtime ADD TABLE mb_threads;
-- ALTER PUBLICATION supabase_realtime ADD TABLE mb_posts;
