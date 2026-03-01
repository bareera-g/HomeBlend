import { createClient } from "@supabase/supabase-js";

const url     = import.meta.env.VITE_SUPABASE_URL      || "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase        = url && anonKey ? createClient(url, anonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
}) : null;
export const isSupabaseReady = Boolean(url && anonKey);

const AVATAR_COLORS = ["#A67C3D","#5C8A6B","#7B6FA0","#C0624A","#4A7EA0","#8A6B5C"];
export function randomAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// ── helpers ───────────────────────────────────────────────────────────────────
function guard(name) {
  if (!supabase) throw new Error(`Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.`);
}

/** Returns true if the error is a "table doesn't exist / schema not ready" error. */
function isSchemaMissing(err) {
  if (!err) return false;
  const msg = err?.message || err?.details || "";
  return (
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("relation") ||
    err?.code === "PGRST200" ||
    err?.code === "42P01"
  );
}

/**
 * Wraps a Supabase query fn. If the table doesn't exist yet (migration not run),
 * returns `fallback` silently instead of crashing the UI.
 */
async function safeQuery(fn, fallback, label = "query") {
  try {
    return await fn();
  } catch (err) {
    if (isSchemaMissing(err)) {
      console.warn(`[HomeBlend] DB table missing for "${label}" — run supabase/migrations/003_complete_schema.sql`);
      return fallback;
    }
    throw err;
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function signUp(email, password, displayName) {
  guard("signUp");
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { display_name: displayName || email.split("@")[0] } },
  });
  if (error) throw error;
  // Profile is auto-created by the DB trigger (handle_new_user).
  // Upsert here as a safety net in case trigger hasn't run yet.
  if (data.user) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      display_name: displayName || email.split("@")[0],
      avatar_color: randomAvatarColor(),
    }, { onConflict: "id" });
  }
  return data;
}

export async function signIn(email, password) {
  guard("signIn");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase?.auth.signOut();
}

// ── Profiles ──────────────────────────────────────────────────────────────────
export async function fetchProfile(userId) {
  guard("fetchProfile");
  return safeQuery(async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    return data;
  }, null, "fetchProfile");
}

export async function ensureProfile(userId, displayName) {
  guard("ensureProfile");
  return safeQuery(async () => {
    const { data: existing } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (existing) return existing;
    const { data } = await supabase.from("profiles")
      .insert({ id: userId, display_name: displayName || "User", avatar_color: randomAvatarColor() })
      .select().single();
    return data;
  }, { id: userId, display_name: displayName || userId.slice(0, 8), avatar_color: randomAvatarColor() }, "ensureProfile");
}

export async function updateProfile(userId, updates) {
  guard("updateProfile");
  const { data, error } = await supabase.from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select().single();
  if (error) throw error;
  return data;
}

// ── Saved Properties ──────────────────────────────────────────────────────────
export async function fetchSavedPropertyIds(userId) {
  guard("fetchSavedPropertyIds");
  return safeQuery(async () => {
    const { data } = await supabase.from("saved_properties")
      .select("property_id").eq("user_id", userId);
    return (data || []).map(r => r.property_id);
  }, [], "fetchSavedPropertyIds");
}

export async function saveProperty(userId, propertyId) {
  guard("saveProperty");
  return safeQuery(() =>
    supabase.from("saved_properties")
      .upsert({ user_id: userId, property_id: propertyId }, { onConflict: "user_id,property_id" }),
    null, "saveProperty"
  );
}

export async function unsaveProperty(userId, propertyId) {
  guard("unsaveProperty");
  return safeQuery(() =>
    supabase.from("saved_properties")
      .delete().eq("user_id", userId).eq("property_id", propertyId),
    null, "unsaveProperty"
  );
}

// ── Rooms ─────────────────────────────────────────────────────────────────────
export async function createRoom(roomCode, userId) {
  guard("createRoom");
  const { data, error } = await supabase.from("rooms")
    .insert({ room_code: roomCode.toUpperCase(), created_by: userId || null })
    .select().single();
  if (error) {
    if (isSchemaMissing(error)) {
      console.warn("[HomeBlend] rooms table not found — run migration 003_complete_schema.sql");
      throw new Error("Database not set up yet. Please run the migration SQL in your Supabase dashboard. See supabase/migrations/003_complete_schema.sql");
    }
    throw error;
  }
  return data;
}

export async function fetchRoom(roomCode) {
  guard("fetchRoom");
  return safeQuery(async () => {
    const { data } = await supabase.from("rooms")
      .select("*").eq("room_code", roomCode.toUpperCase()).maybeSingle();
    return data;
  }, null, "fetchRoom");
}

/** Returns rooms the user is a member of, most recent first. */
export async function fetchUserRooms(userId) {
  guard("fetchUserRooms");
  return safeQuery(async () => {
    const { data, error } = await supabase.from("room_members")
      .select("joined_at, rooms(*)")
      .eq("auth_user_id", userId)
      .order("joined_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(r => r.rooms).filter(Boolean);
  }, [], "fetchUserRooms");
}

/** Join or re-join a room (upsert so it's safe to call multiple times). */
export async function joinRoom(roomId, userId, displayName, avatarColor) {
  guard("joinRoom");
  return safeQuery(async () => {
    const { error } = await supabase.from("room_members").upsert(
      {
        room_id:      roomId,
        auth_user_id: userId,
        display_name: displayName || "Member",
        avatar_color: avatarColor || randomAvatarColor(),
        role:         "member",
      },
      { onConflict: "room_id,auth_user_id" }
    );
    if (error) throw error;
  }, undefined, "joinRoom");
}

/** Leave a room permanently. */
export async function leaveRoom(roomId, userId) {
  guard("leaveRoom");
  return safeQuery(() =>
    supabase.from("room_members")
      .delete().eq("room_id", roomId).eq("auth_user_id", userId),
    null, "leaveRoom"
  );
}

export async function fetchMembers(roomId) {
  guard("fetchMembers");
  return safeQuery(async () => {
    const { data } = await supabase.from("room_members")
      .select("*").eq("room_id", roomId).order("joined_at");
    return data || [];
  }, [], "fetchMembers");
}

/** Update a member's display name inside a room. */
export async function updateMemberName(roomId, userId, displayName) {
  guard("updateMemberName");
  return safeQuery(() =>
    supabase.from("room_members")
      .update({ display_name: displayName })
      .eq("room_id", roomId).eq("auth_user_id", userId),
    null, "updateMemberName"
  );
}

// ── Room Properties ───────────────────────────────────────────────────────────
export async function addPropertyToRoom(roomId, propertyId, userId) {
  guard("addPropertyToRoom");
  return safeQuery(async () => {
    const { error } = await supabase.from("room_properties").upsert(
      { room_id: roomId, property_id: propertyId, added_by: userId },
      { onConflict: "room_id,property_id" }
    );
    if (error) throw error;
  }, undefined, "addPropertyToRoom");
}

export async function removePropertyFromRoom(roomId, propertyId) {
  guard("removePropertyFromRoom");
  return safeQuery(() =>
    supabase.from("room_properties")
      .delete().eq("room_id", roomId).eq("property_id", propertyId),
    null, "removePropertyFromRoom"
  );
}

export async function fetchRoomProperties(roomId) {
  guard("fetchRoomProperties");
  return safeQuery(async () => {
    const { data } = await supabase.from("room_properties")
      .select("*").eq("room_id", roomId).order("added_at");
    return data || [];
  }, [], "fetchRoomProperties");
}

// ── Votes ─────────────────────────────────────────────────────────────────────
export async function recordVote(roomId, userId, propertyId, vote) {
  guard("recordVote");
  return safeQuery(async () => {
    if (vote === null) {
      await supabase.from("votes").delete()
        .eq("room_id", roomId).eq("user_id", userId).eq("property_id", propertyId);
      return;
    }
    const { error } = await supabase.from("votes").upsert(
      { room_id: roomId, user_id: userId, property_id: propertyId, vote },
      { onConflict: "room_id,user_id,property_id" }
    );
    if (error) throw error;
  }, undefined, "recordVote");
}

export async function fetchVotes(roomId) {
  guard("fetchVotes");
  return safeQuery(async () => {
    const { data } = await supabase.from("votes").select("*").eq("room_id", roomId);
    return data || [];
  }, [], "fetchVotes");
}

// ── Realtime subscription builders ────────────────────────────────────────────
/**
 * Subscribe to all collaborative changes in a room.
 * Calls onVotes / onProperties / onMembers when data changes.
 * Returns the channel so caller can remove it on unmount.
 */
export function subscribeToRoom(roomId, { onVotes, onProperties, onMembers }) {
  if (!supabase) return null;
  const channel = supabase.channel(`room:${roomId}:collab`, {
    config: { broadcast: { self: true } },
  });

  if (onVotes) {
    channel.on("postgres_changes", {
      event: "*", schema: "public", table: "votes",
      filter: `room_id=eq.${roomId}`,
    }, onVotes);
  }
  if (onProperties) {
    channel.on("postgres_changes", {
      event: "*", schema: "public", table: "room_properties",
      filter: `room_id=eq.${roomId}`,
    }, onProperties);
  }
  if (onMembers) {
    channel.on("postgres_changes", {
      event: "*", schema: "public", table: "room_members",
      filter: `room_id=eq.${roomId}`,
    }, onMembers);
  }

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      console.log(`[HomeBlend] Realtime connected → room ${roomId}`);
    }
  });

  return channel;
}

export function unsubscribeFromRoom(channel) {
  if (channel && supabase) supabase.removeChannel(channel);
}

// ── Join Requests ─────────────────────────────────────────────────────────────

/** Fetch all join requests for a room (owner only — RLS enforces this). */
export async function fetchJoinRequests(roomId) {
  guard("fetchJoinRequests");
  const { data, error } = await supabase
    .from("room_join_requests")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Send a join request for the current user (uses RPC so SECURITY DEFINER runs insert). */
export async function requestToJoin(roomId, userId, displayName) {
  guard("requestToJoin");
  // Try the RPC first; fallback to direct insert if RPC not deployed yet
  const { data, error } = await supabase.rpc("request_to_join", {
    p_room_id:      roomId,
    p_display_name: displayName || "User",
  });
  if (error) {
    // Fallback: direct insert (works if RLS allows it)
    const { error: e2 } = await supabase.from("room_join_requests").upsert(
      { room_id: roomId, user_id: userId, display_name: displayName || "User", status: "pending" },
      { onConflict: "room_id,user_id" }
    );
    if (e2) throw e2;
    return "pending";
  }
  return data;
}

/** Room owner approves or declines a pending request. */
export async function respondToJoinRequest(requestId, accept, roomId) {
  guard("respondToJoinRequest");
  // Try the RPC first
  const { data, error } = await supabase.rpc("respond_join_request", {
    p_request_id: requestId,
    p_accept:     accept,
  });
  if (error) {
    // Fallback: manual update
    const status = accept ? "approved" : "declined";
    await supabase.from("room_join_requests").update({ status }).eq("id", requestId);
    if (accept) {
      const { data: req } = await supabase.from("room_join_requests").select("*").eq("id", requestId).single();
      if (req) {
        await supabase.from("room_members").upsert(
          { room_id: req.room_id, auth_user_id: req.user_id, display_name: req.display_name, role: "member", avatar_color: randomAvatarColor() },
          { onConflict: "room_id,auth_user_id" }
        );
      }
    }
    return status;
  }
  return data;
}
