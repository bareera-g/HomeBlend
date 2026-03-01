-- ═══════════════════════════════════════════════════════════════════════════
-- HomeBlend — Add-on tables (safe to run multiple times, uses IF NOT EXISTS)
--
-- Your DB already has:
--   blends, blend_members, blend_join_requests, blend_properties,
--   blend_property_votes, properties, floorplans
--
-- This adds only the 3 missing tables + RLS + auto-profile trigger.
-- Paste the entire file into the Supabase SQL editor and click Run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. profiles ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL DEFAULT 'User',
  avatar_color  TEXT NOT NULL DEFAULT '#A67C3D',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE  USING (auth.uid() = id);

-- ── 2. saved_properties ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_properties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL,
  saved_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

ALTER TABLE saved_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_select" ON saved_properties;
DROP POLICY IF EXISTS "saved_insert" ON saved_properties;
DROP POLICY IF EXISTS "saved_delete" ON saved_properties;

CREATE POLICY "saved_select" ON saved_properties FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saved_insert" ON saved_properties FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_delete" ON saved_properties FOR DELETE USING (auth.uid() = user_id);

-- ── 3. room_properties ────────────────────────────────────────────────────────
-- Properties added to a blend (uses our integer mock property IDs).
CREATE TABLE IF NOT EXISTS room_properties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blend_id    UUID NOT NULL REFERENCES blends(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL,
  added_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blend_id, property_id)
);

ALTER TABLE room_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_props_select" ON room_properties;
DROP POLICY IF EXISTS "room_props_insert" ON room_properties;
DROP POLICY IF EXISTS "room_props_delete" ON room_properties;

-- Any authenticated user can read/insert/delete (rooms are collaborative)
CREATE POLICY "room_props_select" ON room_properties FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "room_props_insert" ON room_properties FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "room_props_delete" ON room_properties FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── 4. room_votes ─────────────────────────────────────────────────────────────
-- Like / dislike votes on properties within a blend.
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

DROP POLICY IF EXISTS "room_votes_select" ON room_votes;
DROP POLICY IF EXISTS "room_votes_insert" ON room_votes;
DROP POLICY IF EXISTS "room_votes_update" ON room_votes;
DROP POLICY IF EXISTS "room_votes_delete" ON room_votes;

CREATE POLICY "room_votes_select" ON room_votes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "room_votes_insert" ON room_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "room_votes_update" ON room_votes FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "room_votes_delete" ON room_votes FOR DELETE  USING (auth.uid() = user_id);

-- ── 5. Realtime ───────────────────────────────────────────────────────────────
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE profiles;        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE room_properties;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE room_votes;       EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 6. Auto-create profile on sign-up ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── 7. create_blend RPC (idempotent) ─────────────────────────────────────────
-- Creates a blend and auto-joins the creator as owner.
CREATE OR REPLACE FUNCTION create_blend(p_name TEXT DEFAULT 'My Room')
RETURNS TABLE(id UUID, name TEXT, invite_code TEXT, created_by UUID, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_blend blends;
BEGIN
  INSERT INTO blends (name, created_by) VALUES (p_name, auth.uid()) RETURNING * INTO v_blend;
  INSERT INTO blend_members (blend_id, user_id, role) VALUES (v_blend.id, auth.uid(), 'owner')
    ON CONFLICT DO NOTHING;
  RETURN QUERY SELECT v_blend.id, v_blend.name, v_blend.invite_code, v_blend.created_by, v_blend.created_at;
END;
$$;
