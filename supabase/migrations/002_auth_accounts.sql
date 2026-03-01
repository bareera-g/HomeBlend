-- HomeBlend — Auth, accounts, room properties, and voting
-- Run AFTER 001_initial.sql

CREATE TABLE IF NOT EXISTS profiles (
  id            UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name  TEXT NOT NULL DEFAULT 'User',
  avatar_color  TEXT DEFAULT '#A67C3D',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_properties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  property_id INTEGER NOT NULL,
  saved_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

CREATE TABLE IF NOT EXISTS room_properties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  property_id INTEGER NOT NULL,
  added_by    UUID REFERENCES auth.users(id),
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, property_id)
);

CREATE TABLE IF NOT EXISTS votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES auth.users(id) NOT NULL,
  property_id INTEGER NOT NULL,
  vote        SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  voted_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id, property_id)
);

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_properties  ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_properties   ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes             ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_all"         ON profiles          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "saved_properties_all" ON saved_properties  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "room_properties_all"  ON room_properties   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "votes_all"            ON votes             FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE profiles, saved_properties, room_properties, votes;
