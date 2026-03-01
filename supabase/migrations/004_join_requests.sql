-- ═══════════════════════════════════════════════════════════════════════════
-- HomeBlend — Migration 004: Join-request flow + helper RPCs
-- Run in Supabase SQL editor:
--   https://supabase.com/dashboard/project/hawvhqhqftkafbpxwyll/sql/new
-- ═══════════════════════════════════════════════════════════════════════════

-- ── room_join_requests ────────────────────────────────────────────────────────
-- Tracks pending / approved / declined join requests per room.
CREATE TABLE IF NOT EXISTS room_join_requests (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id      UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'User',
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (room_id, user_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_room_join_requests_room   ON room_join_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_room_join_requests_user   ON room_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_room_join_requests_status ON room_join_requests(status);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE room_join_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "rjr_select"  ON room_join_requests;
  DROP POLICY IF EXISTS "rjr_insert"  ON room_join_requests;
  DROP POLICY IF EXISTS "rjr_update"  ON room_join_requests;
  DROP POLICY IF EXISTS "rjr_delete"  ON room_join_requests;
END $$;

-- Authenticated users can see requests for rooms they own or their own requests
CREATE POLICY "rjr_select" ON room_join_requests FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT created_by FROM rooms WHERE id = room_id)
  );

-- Any authenticated user can submit a join request
CREATE POLICY "rjr_insert" ON room_join_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only the room owner can update request status
CREATE POLICY "rjr_update" ON room_join_requests FOR UPDATE
  USING (auth.uid() IN (SELECT created_by FROM rooms WHERE id = room_id));

-- Users can delete their own pending requests; owners can delete any
CREATE POLICY "rjr_delete" ON room_join_requests FOR DELETE
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT created_by FROM rooms WHERE id = room_id)
  );

-- ── Realtime ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE room_join_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── RPC: request_to_join ──────────────────────────────────────────────────────
-- Creates a pending join request. Safe to call multiple times (upsert).
CREATE OR REPLACE FUNCTION request_to_join(p_room_id UUID, p_display_name TEXT DEFAULT 'User')
RETURNS TEXT AS $$
DECLARE
  v_status TEXT;
BEGIN
  INSERT INTO room_join_requests (room_id, user_id, display_name, status)
  VALUES (p_room_id, auth.uid(), p_display_name, 'pending')
  ON CONFLICT (room_id, user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        status       = CASE WHEN room_join_requests.status = 'declined' THEN 'pending'
                            ELSE room_join_requests.status END;

  SELECT status INTO v_status FROM room_join_requests
  WHERE room_id = p_room_id AND user_id = auth.uid();
  RETURN v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC: respond_join_request ────────────────────────────────────────────────
-- Room owner approves or declines a request. On approve, adds user to room_members.
CREATE OR REPLACE FUNCTION respond_join_request(
  p_request_id UUID,
  p_accept     BOOLEAN
)
RETURNS TEXT AS $$
DECLARE
  v_req    room_join_requests;
  v_room   rooms;
  v_color  TEXT;
BEGIN
  SELECT * INTO v_req FROM room_join_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  SELECT * INTO v_room FROM rooms WHERE id = v_req.room_id;
  IF v_room.created_by <> auth.uid() THEN
    RAISE EXCEPTION 'Only the room owner can respond to join requests';
  END IF;

  IF p_accept THEN
    UPDATE room_join_requests SET status = 'approved' WHERE id = p_request_id;

    v_color := (ARRAY['#A67C3D','#5C8A6B','#7B6FA0','#C0624A','#4A7EA0','#8A6B5C'])[floor(random()*6+1)];
    INSERT INTO room_members (room_id, auth_user_id, display_name, avatar_color, role)
    VALUES (v_req.room_id, v_req.user_id, v_req.display_name, v_color, 'member')
    ON CONFLICT (room_id, auth_user_id) DO NOTHING;

    RETURN 'approved';
  ELSE
    UPDATE room_join_requests SET status = 'declined' WHERE id = p_request_id;
    RETURN 'declined';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
