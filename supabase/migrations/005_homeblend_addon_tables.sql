-- ═══════════════════════════════════════════════════════════════════════════
-- HomeBlend — Add-on tables for existing schema
--
-- The existing DB already has:
--   blends, blend_members, blend_properties, blend_property_votes,
--   blend_join_requests, properties, floorplans
--
-- This migration ONLY adds what's missing:
--   profiles            — user display names + avatar colors
--   saved_properties    — per-user saved properties (integer mock IDs)
--   room_properties     — properties added to a blend (integer mock IDs)
--   room_votes          — votes on properties in a blend (like / dislike)
--
-- Run in Supabase SQL editor:
--   https://supabase.com/dashboard/project/hawvhqhqftkafbpxwyll/sql/new
-- ═══════════════════════════════════════════════════════════════════════════

-- ── profiles ──────────────────────────────────────────────────────────────────
-- Stores display names and avatar colors for every HomeBlend user.
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name  TEXT NOT NULL DEFAULT 'User',
  avatar_color  TEXT NOT NULL DEFAULT '#A67C3D',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── saved_properties ──────────────────────────────────────────────────────────
-- Users can save/bookmark mock properties (identified by integer ID).
CREATE TABLE IF NOT EXISTS saved_properties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  property_id INTEGER NOT NULL,
  saved_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

-- ── room_properties ───────────────────────────────────────────────────────────
-- Properties dragged into a blend/room (mock integer IDs).
-- Linked to the existing `blends` table via blend_id.
CREATE TABLE IF NOT EXISTS room_properties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blend_id    UUID REFERENCES blends(id) ON DELETE CASCADE NOT NULL,
  property_id INTEGER NOT NULL,
  added_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blend_id, property_id)
);

-- ── room_votes ────────────────────────────────────────────────────────────────
-- Like / dislike votes on properties within a blend.
-- Uses text votes ('like' | 'dislike') consistent with blend_property_votes.
CREATE TABLE IF NOT EXISTS room_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blend_id    UUID REFERENCES blends(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  property_id INTEGER NOT NULL,
  vote        TEXT NOT NULL CHECK (vote IN ('like', 'dislike')),
  voted_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blend_id, user_id, property_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_id            ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_saved_props_user        ON saved_properties(user_id);
CREATE INDEX IF NOT EXISTS idx_room_properties_blend   ON room_properties(blend_id);
CREATE INDEX IF NOT EXISTS idx_room_votes_blend        ON room_votes(blend_id);
CREATE INDEX IF NOT EXISTS idx_room_votes_user         ON room_votes(user_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_properties  ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_properties   ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_votes        ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "profiles_select"      ON profiles;
  DROP POLICY IF EXISTS "profiles_insert"      ON profiles;
  DROP POLICY IF EXISTS "profiles_update"      ON profiles;
  DROP POLICY IF EXISTS "saved_select"         ON saved_properties;
  DROP POLICY IF EXISTS "saved_insert"         ON saved_properties;
  DROP POLICY IF EXISTS "saved_delete"         ON saved_properties;
  DROP POLICY IF EXISTS "room_props_select"    ON room_properties;
  DROP POLICY IF EXISTS "room_props_insert"    ON room_properties;
  DROP POLICY IF EXISTS "room_props_delete"    ON room_properties;
  DROP POLICY IF EXISTS "room_votes_select"    ON room_votes;
  DROP POLICY IF EXISTS "room_votes_upsert"    ON room_votes;
  DROP POLICY IF EXISTS "room_votes_delete"    ON room_votes;
END $$;

-- profiles: anyone can read; users write their own
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE  USING (auth.uid() = id);

-- saved_properties: users manage their own only
CREATE POLICY "saved_select" ON saved_properties FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saved_insert" ON saved_properties FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_delete" ON saved_properties FOR DELETE USING (auth.uid() = user_id);

-- room_properties: blend members read; any authenticated user adds; adder or blend owner deletes
CREATE POLICY "room_props_select" ON room_properties FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM blend_members WHERE blend_id = room_properties.blend_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM blends WHERE id = room_properties.blend_id AND created_by = auth.uid()
  ));
CREATE POLICY "room_props_insert" ON room_properties FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "room_props_delete" ON room_properties FOR DELETE
  USING (auth.uid() = added_by OR EXISTS (
    SELECT 1 FROM blends WHERE id = room_properties.blend_id AND created_by = auth.uid()
  ));

-- room_votes: blend members read; users write their own; users delete their own
CREATE POLICY "room_votes_select" ON room_votes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM blend_members WHERE blend_id = room_votes.blend_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM blends WHERE id = room_votes.blend_id AND created_by = auth.uid()
  ));
CREATE POLICY "room_votes_upsert" ON room_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "room_votes_delete" ON room_votes FOR DELETE USING (auth.uid() = user_id);

-- ── Realtime ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE room_properties;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE room_votes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE blend_members;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

-- ── Auto-update updated_at on profiles ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── create_blend RPC (security definer — bypasses RLS for room creation) ──────
CREATE OR REPLACE FUNCTION create_blend(p_name TEXT DEFAULT 'My Room')
RETURNS TABLE(id UUID, name TEXT, invite_code TEXT, created_by UUID, created_at TIMESTAMPTZ) AS $$
DECLARE
  v_blend blends;
BEGIN
  INSERT INTO blends (name, created_by)
  VALUES (p_name, auth.uid())
  RETURNING * INTO v_blend;

  -- Auto-join creator as owner
  INSERT INTO blend_members (blend_id, user_id, role)
  VALUES (v_blend.id, auth.uid(), 'owner')
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT v_blend.id, v_blend.name, v_blend.invite_code, v_blend.created_by, v_blend.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── request_to_join RPC ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION request_to_join(p_invite_code TEXT)
RETURNS TEXT AS $$
DECLARE
  v_blend_id UUID;
BEGIN
  SELECT id INTO v_blend_id FROM blends WHERE invite_code = upper(p_invite_code);
  IF NOT FOUND THEN RAISE EXCEPTION 'Blend not found'; END IF;

  INSERT INTO blend_join_requests (blend_id, user_id, email, status)
  VALUES (v_blend_id, auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'pending')
  ON CONFLICT (blend_id, user_id) DO UPDATE
    SET status = CASE WHEN blend_join_requests.status = 'declined' THEN 'pending'
                      ELSE blend_join_requests.status END;

  RETURN (SELECT status FROM blend_join_requests WHERE blend_id = v_blend_id AND user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── respond_join_request RPC ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION respond_join_request(p_request_id UUID, p_accept BOOLEAN)
RETURNS TEXT AS $$
DECLARE
  v_req blend_join_requests;
BEGIN
  SELECT * INTO v_req FROM blend_join_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  IF (SELECT created_by FROM blends WHERE id = v_req.blend_id) <> auth.uid() THEN
    RAISE EXCEPTION 'Only the blend owner can respond to join requests';
  END IF;

  IF p_accept THEN
    UPDATE blend_join_requests SET status = 'accepted' WHERE id = p_request_id;
    INSERT INTO blend_members (blend_id, user_id, role)
    VALUES (v_req.blend_id, v_req.user_id, 'member')
    ON CONFLICT DO NOTHING;
    RETURN 'accepted';
  ELSE
    UPDATE blend_join_requests SET status = 'declined' WHERE id = p_request_id;
    RETURN 'declined';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
