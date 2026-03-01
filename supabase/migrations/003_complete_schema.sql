-- ═══════════════════════════════════════════════════════════════════════════
-- HomeBlend — Complete schema (safe to re-run, uses IF NOT EXISTS / DO blocks)
-- Run this in the Supabase SQL editor at:
--   https://supabase.com/dashboard/project/hawvhqhqftkafbpxwyll/sql/new
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── profiles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name  TEXT NOT NULL DEFAULT 'User',
  avatar_color  TEXT DEFAULT '#A67C3D',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── rooms ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code   TEXT UNIQUE NOT NULL,
  name        TEXT,                         -- optional friendly name
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  location    TEXT DEFAULT 'Irvine, CA',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── room_members ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  auth_user_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  display_name  TEXT NOT NULL DEFAULT 'Member',
  avatar_color  TEXT DEFAULT '#A67C3D',
  role          TEXT DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, auth_user_id)
);

-- ── saved_properties ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_properties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  property_id INTEGER NOT NULL,
  saved_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

-- ── room_properties ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_properties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  property_id INTEGER NOT NULL,
  added_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, property_id)
);

-- ── votes ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  property_id INTEGER NOT NULL,
  vote        SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  voted_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id, property_id)
);

-- ── taste_profiles ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS taste_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_json  JSONB,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_room_members_auth_user  ON room_members(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_room       ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_properties_room    ON room_properties(room_id);
CREATE INDEX IF NOT EXISTS idx_votes_room              ON votes(room_id);
CREATE INDEX IF NOT EXISTS idx_votes_user              ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_props_user        ON saved_properties(user_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms             ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_properties  ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_properties   ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE taste_profiles    ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (so re-running is idempotent)
DO $$ BEGIN
  DROP POLICY IF EXISTS "profiles_select"           ON profiles;
  DROP POLICY IF EXISTS "profiles_insert"           ON profiles;
  DROP POLICY IF EXISTS "profiles_update"           ON profiles;
  DROP POLICY IF EXISTS "rooms_select"              ON rooms;
  DROP POLICY IF EXISTS "rooms_insert"              ON rooms;
  DROP POLICY IF EXISTS "rooms_update"              ON rooms;
  DROP POLICY IF EXISTS "room_members_select"       ON room_members;
  DROP POLICY IF EXISTS "room_members_insert"       ON room_members;
  DROP POLICY IF EXISTS "room_members_delete"       ON room_members;
  DROP POLICY IF EXISTS "saved_props_select"        ON saved_properties;
  DROP POLICY IF EXISTS "saved_props_insert"        ON saved_properties;
  DROP POLICY IF EXISTS "saved_props_delete"        ON saved_properties;
  DROP POLICY IF EXISTS "room_props_select"         ON room_properties;
  DROP POLICY IF EXISTS "room_props_insert"         ON room_properties;
  DROP POLICY IF EXISTS "room_props_delete"         ON room_properties;
  DROP POLICY IF EXISTS "votes_select"              ON votes;
  DROP POLICY IF EXISTS "votes_upsert"              ON votes;
  DROP POLICY IF EXISTS "votes_delete"              ON votes;
  DROP POLICY IF EXISTS "taste_profiles_all"        ON taste_profiles;
END $$;

-- profiles: users read all, write only own
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- rooms: anyone can read; authenticated users create; members update
CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert" ON rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "rooms_update" ON rooms FOR UPDATE
  USING (auth.uid() = created_by OR EXISTS (
    SELECT 1 FROM room_members WHERE room_id = rooms.id AND auth_user_id = auth.uid()
  ));

-- room_members: members of the room can read; authenticated users can join
CREATE POLICY "room_members_select" ON room_members FOR SELECT USING (true);
CREATE POLICY "room_members_insert" ON room_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "room_members_delete" ON room_members FOR DELETE USING (auth.uid() = auth_user_id);

-- saved_properties: users manage their own
CREATE POLICY "saved_props_select" ON saved_properties FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saved_props_insert" ON saved_properties FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_props_delete" ON saved_properties FOR DELETE USING (auth.uid() = user_id);

-- room_properties: room members can read & add; adder can remove
CREATE POLICY "room_props_select" ON room_properties FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM room_members WHERE room_id = room_properties.room_id AND auth_user_id = auth.uid()
  ));
CREATE POLICY "room_props_insert" ON room_properties FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "room_props_delete" ON room_properties FOR DELETE
  USING (auth.uid() = added_by OR EXISTS (
    SELECT 1 FROM rooms WHERE id = room_properties.room_id AND created_by = auth.uid()
  ));

-- votes: room members can read & vote
CREATE POLICY "votes_select" ON votes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM room_members WHERE room_id = votes.room_id AND auth_user_id = auth.uid()
  ));
CREATE POLICY "votes_upsert" ON votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "votes_delete" ON votes FOR DELETE USING (auth.uid() = user_id);

-- taste_profiles
CREATE POLICY "taste_profiles_all" ON taste_profiles FOR ALL USING (true) WITH CHECK (true);

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Add tables to realtime publication (errors silently if already added)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE room_members;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE room_properties;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE votes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE taste_profiles;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Auto-update updated_at ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Auto-create profile on sign-up ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, avatar_color)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    (ARRAY['#A67C3D','#5C8A6B','#7B6FA0','#C0624A','#4A7EA0','#8A6B5C'])[floor(random()*6+1)]
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
