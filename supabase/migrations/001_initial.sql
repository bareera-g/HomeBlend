-- HomeBlend Web — initial schema
CREATE TABLE IF NOT EXISTS rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code   TEXT UNIQUE NOT NULL,
  created_by  UUID,
  location    TEXT DEFAULT 'Irvine, CA',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  auth_user_id  UUID,
  display_name  TEXT NOT NULL,
  avatar_color  TEXT DEFAULT '#A67C3D',
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS swipes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  property_id INTEGER NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('like', 'pass')),
  swiped_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id, property_id)
);

CREATE TABLE IF NOT EXISTS taste_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  profile_json  JSONB,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE rooms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE taste_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read rooms"         ON rooms         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public read members"       ON room_members  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public read swipes"        ON swipes        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public read profiles"      ON taste_profiles FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE rooms, room_members, swipes, taste_profiles;
