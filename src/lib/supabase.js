/**
 * HomeBlend — Supabase client
 *
 * Uses the rooms schema defined in:
 *   supabase/migrations/003_complete_schema.sql  (rooms, room_members, room_properties, votes, saved_properties, profiles)
 *   supabase/migrations/004_join_requests.sql    (room_join_requests, request_to_join RPC, respond_join_request RPC)
 *
 * Run BOTH SQL files in your Supabase SQL editor once and everything works.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL      || "";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase        = SUPABASE_URL && SUPABASE_ANON
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null;
export const isSupabaseReady = Boolean(SUPABASE_URL && SUPABASE_ANON);

const AVATAR_COLORS = ["#A67C3D","#5C8A6B","#7B6FA0","#C0624A","#4A7EA0","#8A6B5C"];
export function randomAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// ── Internal helpers ──────────────────────────────────────────────────────────
function guard() {
  if (!supabase) throw new Error("Supabase not configured — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local");
}

export function isSchemaMissing(err) {
  if (!err) return false;
  const msg = (err?.message || err?.details || err?.hint || "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("relation") ||
    err?.code === "PGRST200" ||
    err?.code === "42P01" ||
    err?.code === "PGRST205"
  );
}

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    if (isSchemaMissing(err)) {
      console.warn("[HomeBlend] table missing — run 003_complete_schema.sql:", err.message);
      return fallback;
    }
    throw err;
  }
}

function ignoreDuplicate(err) {
  if (!err) return;
  const msg = (err.message || "").toLowerCase();
  if (msg.includes("duplicate") || msg.includes("unique") || err.code === "23505") return;
  throw err;
}

function genCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function signUp(email, password, displayName) {
  guard();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { display_name: displayName || email.split("@")[0] } },
  });
  if (error) throw error;
  // The on_auth_user_created trigger (in 003_complete_schema.sql) handles profile creation.
  // Also try directly in case the trigger isn't set up yet.
  if (data.user) {
    await safe(() => supabase.from("profiles").insert({
      id:           data.user.id,
      display_name: displayName || email.split("@")[0],
      avatar_color: randomAvatarColor(),
    }), null);
  }
  return data;
}

export async function signIn(email, password) {
  guard();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() { await supabase?.auth.signOut(); }

// ── Profiles ──────────────────────────────────────────────────────────────────
export async function fetchProfile(userId) {
  guard();
  return safe(async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    return data;
  }, null);
}

export async function ensureProfile(userId, displayName) {
  guard();
  const fallback = { id: userId, display_name: displayName || "User", avatar_color: randomAvatarColor() };
  return safe(async () => {
    const { data: existing } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (existing) return existing;
    const { data, error } = await supabase.from("profiles")
      .insert({ id: userId, display_name: displayName || "User", avatar_color: randomAvatarColor() })
      .select().maybeSingle();
    if (error) { ignoreDuplicate(error); return fallback; }
    return data || fallback;
  }, fallback);
}

export async function updateProfile(userId, updates) {
  guard();
  return safe(async () => {
    const { data, error } = await supabase.from("profiles")
      .update(updates).eq("id", userId).select().maybeSingle();
    if (error) throw error;
    return data;
  }, null);
}

// ── Saved Properties ──────────────────────────────────────────────────────────
export async function fetchSavedPropertyIds(userId) {
  guard();
  return safe(async () => {
    const { data } = await supabase.from("saved_properties").select("property_id").eq("user_id", userId);
    return (data || []).map(r => r.property_id);
  }, []);
}

export async function saveProperty(userId, propertyId) {
  guard();
  return safe(() =>
    supabase.from("saved_properties")
      .insert({ user_id: userId, property_id: propertyId })
      .then(({ error }) => { ignoreDuplicate(error); }),
    null);
}

export async function unsaveProperty(userId, propertyId) {
  guard();
  return safe(() =>
    supabase.from("saved_properties").delete().eq("user_id", userId).eq("property_id", propertyId),
    null);
}

// ── Rooms ─────────────────────────────────────────────────────────────────────
// Uses the `rooms` table. room_code is a short alphanumeric code we generate.

export async function createRoom(name, userId) {
  guard();
  const code = genCode();
  const { data, error } = await supabase.from("rooms")
    .insert({ room_code: code, name: name || "My Room", created_by: userId })
    .select().maybeSingle();
  if (error) {
    if (isSchemaMissing(error)) {
      throw new Error("Database tables not set up. Run supabase/migrations/003_complete_schema.sql in your Supabase SQL editor.");
    }
    throw error;
  }
  // Auto-add creator as owner member
  const { error: memErr } = await supabase.from("room_members").insert({
    room_id:      data.id,
    auth_user_id: userId,
    display_name: "Owner",
    avatar_color: randomAvatarColor(),
    role:         "owner",
  });
  if (memErr) ignoreDuplicate(memErr);
  // Best-effort profile save
  await _upsertProfile(userId);
  return data; // includes data.room_code
}

export async function fetchRoom(roomCode) {
  guard();
  return safe(async () => {
    const { data } = await supabase.from("rooms")
      .select("*").eq("room_code", roomCode.toUpperCase()).maybeSingle();
    return data || null;
  }, null);
}

export async function fetchUserRooms(userId) {
  guard();
  return safe(async () => {
    const { data, error } = await supabase.from("room_members")
      .select("joined_at, rooms(id, name, room_code, created_by, created_at)")
      .eq("auth_user_id", userId)
      .order("joined_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(r => r.rooms).filter(Boolean);
  }, []);
}

export async function joinRoom(roomId, userId, displayName, avatarColor) {
  guard();
  return safe(async () => {
    const { error } = await supabase.from("room_members").insert({
      room_id:      roomId,
      auth_user_id: userId,
      display_name: displayName || "Member",
      avatar_color: avatarColor || randomAvatarColor(),
      role:         "member",
    });
    if (error) ignoreDuplicate(error);
    await _upsertProfile(userId, displayName, avatarColor);
  }, undefined);
}

export async function leaveRoom(roomId, userId) {
  guard();
  return safe(() =>
    supabase.from("room_members").delete().eq("room_id", roomId).eq("auth_user_id", userId),
    null);
}

export async function fetchMembers(roomId) {
  guard();
  return safe(async () => {
    const { data, error } = await supabase.from("room_members")
      .select("*").eq("room_id", roomId).order("joined_at");
    if (error) throw error;
    return (data || []).map(m => ({
      ...m,
      auth_user_id: m.auth_user_id,
      display_name: m.display_name || "Member",
      avatar_color: m.avatar_color || "#A67C3D",
    }));
  }, []);
}

// ── Room Properties ───────────────────────────────────────────────────────────
// Uses the `room_properties` table with `room_id` FK.

export async function addPropertyToRoom(roomId, propertyId, userId) {
  guard();
  const { error } = await supabase.from("room_properties").upsert(
    { room_id: roomId, property_id: Number(propertyId), added_by: userId },
    { onConflict: "room_id,property_id" }
  );
  if (error) {
    if (error.code === "23505") return;
    console.error("[HomeBlend] addPropertyToRoom failed:", error);
    throw error;
  }
}

export async function removePropertyFromRoom(roomId, propertyId) {
  guard();
  return safe(() =>
    supabase.from("room_properties").delete().eq("room_id", roomId).eq("property_id", Number(propertyId)),
    null);
}

export async function fetchRoomProperties(roomId) {
  guard();
  return safe(async () => {
    const { data, error } = await supabase.from("room_properties")
      .select("*").eq("room_id", roomId).order("added_at");
    if (error) throw error;
    return (data || []).map(r => ({
      ...r,
      property_id: Number(r.property_id),
      room_id:     roomId,
    }));
  }, []);
}

// ── Votes ─────────────────────────────────────────────────────────────────────
// Stored as SMALLINT -1 or 1 (the `votes` table in 003_complete_schema.sql).

export async function recordVote(roomId, userId, propertyId, vote) {
  guard();
  const pid = Number(propertyId);
  if (vote === null) {
    await supabase.from("votes").delete()
      .eq("room_id", roomId).eq("user_id", userId).eq("property_id", pid);
    return;
  }
  const voteVal = (vote === 1 || vote === "like") ? 1 : -1;
  const { error } = await supabase.from("votes").upsert(
    { room_id: roomId, user_id: userId, property_id: pid, vote: voteVal },
    { onConflict: "room_id,user_id,property_id" }
  );
  if (error) {
    console.error("[HomeBlend] recordVote failed:", error);
    throw error;
  }
}

export async function fetchVotes(roomId) {
  guard();
  return safe(async () => {
    const { data } = await supabase.from("votes").select("*").eq("room_id", roomId);
    // vote is already -1 or 1 (stored as smallint)
    return (data || []).map(v => ({ ...v, room_id: roomId }));
  }, []);
}

// ── Join Requests ─────────────────────────────────────────────────────────────
// Uses `room_join_requests` table + RPCs from 004_join_requests.sql.

export async function fetchJoinRequests(roomId) {
  guard();
  return safe(async () => {
    const { data, error } = await supabase.from("room_join_requests")
      .select("*").eq("room_id", roomId).order("created_at", { ascending: false });
    if (error) throw error;
    // Normalise: 'approved' → 'accepted' for UI compatibility
    return (data || []).map(r => ({ ...r, status: r.status === "approved" ? "accepted" : r.status }));
  }, []);
}

export async function requestToJoin(roomId, userId, displayName) {
  guard();
  return safe(async () => {
    // Try RPC first (004_join_requests.sql)
    const { data, error } = await supabase.rpc("request_to_join", {
      p_room_id:      roomId,
      p_display_name: displayName || "User",
    });
    if (!error) return data === "approved" ? "accepted" : data;
    // Fallback: direct insert
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email || "";
    const { error: insErr } = await supabase.from("room_join_requests")
      .insert({ room_id: roomId, user_id: userId, display_name: displayName || "User", status: "pending" });
    if (insErr) ignoreDuplicate(insErr);
    return "pending";
  }, "pending");
}

export async function respondToJoinRequest(requestId, accept) {
  guard();
  return safe(async () => {
    // Try RPC first (004_join_requests.sql)
    const { data, error } = await supabase.rpc("respond_join_request", {
      p_request_id: requestId,
      p_accept:     accept,
    });
    if (!error) return data === "approved" ? "accepted" : data;
    // Fallback: direct update
    const status = accept ? "approved" : "declined";
    await supabase.from("room_join_requests").update({ status }).eq("id", requestId);
    if (accept) {
      const { data: req } = await supabase.from("room_join_requests")
        .select("room_id, user_id").eq("id", requestId).maybeSingle();
      if (req) {
        await supabase.from("room_members").insert({
          room_id: req.room_id, auth_user_id: req.user_id,
          display_name: "Member", avatar_color: randomAvatarColor(), role: "member",
        }).then(({ error: e }) => { if (e) ignoreDuplicate(e); });
      }
    }
    return accept ? "accepted" : "declined";
  }, accept ? "accepted" : "declined");
}

// ── Realtime ──────────────────────────────────────────────────────────────────
export function subscribeToRoom(roomId, { onVotes, onProperties, onMembers } = {}) {
  if (!supabase) return null;
  const channel = supabase.channel(`room:${roomId}`);
  if (onVotes) channel.on("postgres_changes",
    { event: "*", schema: "public", table: "votes", filter: `room_id=eq.${roomId}` }, onVotes);
  if (onProperties) channel.on("postgres_changes",
    { event: "*", schema: "public", table: "room_properties", filter: `room_id=eq.${roomId}` }, onProperties);
  if (onMembers) channel.on("postgres_changes",
    { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, onMembers);
  channel.subscribe();
  return channel;
}

export function unsubscribeFromRoom(channel) {
  if (channel && supabase) supabase.removeChannel(channel);
}

// ── Internal ──────────────────────────────────────────────────────────────────
async function _upsertProfile(userId, displayName, avatarColor) {
  if (!userId) return;
  try {
    const { data: existing } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (existing) {
      if (displayName) await supabase.from("profiles").update({ display_name: displayName }).eq("id", userId);
    } else {
      await supabase.from("profiles").insert({
        id:           userId,
        display_name: displayName || "User",
        avatar_color: avatarColor || randomAvatarColor(),
      });
    }
  } catch { /* profiles table not ready yet */ }
}
