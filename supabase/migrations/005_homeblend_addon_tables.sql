-- HomeBlend — minimal add-on tables
-- Run this in the Supabase SQL editor. Nothing fancy — just 4 tables.

-- 1. profiles
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'User',
  avatar_color TEXT NOT NULL DEFAULT '#A67C3D',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_sel" ON profiles;
DROP POLICY IF EXISTS "p_ins" ON profiles;
DROP POLICY IF EXISTS "p_upd" ON profiles;
CREATE POLICY "p_sel" ON profiles FOR SELECT USING (true);
CREATE POLICY "p_ins" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "p_upd" ON profiles FOR UPDATE USING (true);

-- 2. saved_properties
CREATE TABLE IF NOT EXISTS saved_properties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL,
  saved_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);
ALTER TABLE saved_properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sp_all" ON saved_properties;
CREATE POLICY "sp_all" ON saved_properties USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. room_properties
CREATE TABLE IF NOT EXISTS room_properties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blend_id    UUID NOT NULL REFERENCES blends(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL,
  added_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blend_id, property_id)
);
ALTER TABLE room_properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rp_all" ON room_properties;
CREATE POLICY "rp_all" ON room_properties USING (true) WITH CHECK (true);

-- 4. room_votes
CREATE TABLE IF NOT EXISTS room_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blend_id    UUID NOT NULL REFERENCES blends(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL,
  vote        TEXT NOT NULL CHECK (vote IN ('like', 'dislike')),
  voted_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blend_id, user_id, property_id)
);
ALTER TABLE room_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rv_all" ON room_votes;
CREATE POLICY "rv_all" ON room_votes USING (true) WITH CHECK (true);
