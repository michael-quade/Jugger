-- Juggerknocker Board — Phase 2 Schema
-- Run this in the Supabase SQL editor AFTER Phase 1 schema is in place.

-- 1. Add image_urls column to mb_posts (if not already present)
ALTER TABLE mb_posts ADD COLUMN IF NOT EXISTS image_urls text[];

-- 2. Emoji reactions table
CREATE TABLE IF NOT EXISTS mb_reactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  uuid NOT NULL REFERENCES mb_threads(id) ON DELETE CASCADE,
  post_id    uuid NOT NULL REFERENCES mb_posts(id)   ON DELETE CASCADE,
  author     text NOT NULL,
  emoji      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, author, emoji)
);

CREATE INDEX IF NOT EXISTS mb_reactions_thread_idx ON mb_reactions (thread_id);
CREATE INDEX IF NOT EXISTS mb_reactions_post_idx   ON mb_reactions (post_id);

-- 3. Enable RLS on mb_reactions with open anon policy (same pattern as mb_threads/mb_posts)
ALTER TABLE mb_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_mb_reactions" ON mb_reactions FOR ALL TO anon USING (true) WITH CHECK (true);

-- 4. Enable Realtime on mb_reactions (so reaction bar updates live)
ALTER PUBLICATION supabase_realtime ADD TABLE mb_reactions;

-- ─────────────────────────────────────────────────────────────
-- 5. Storage bucket for board photos
--    Do this in Supabase Dashboard → Storage → New bucket:
--      Name:          jugger-board
--      Public access: ON  (images served by URL without auth)
--
--    Then add a storage policy so anon can upload/read:
--      Dashboard → Storage → jugger-board → Policies → New policy
--        Policy name:  anon_all
--        Allowed operation: SELECT, INSERT, UPDATE, DELETE
--        Target roles: anon
--        USING expression: true
-- ─────────────────────────────────────────────────────────────
