/**
 * HomeBlend — Supabase client
 *
 * Maps our app concepts to the existing Supabase schema:
 *   "rooms"          → blends            (invite_code = join code)
 *   "room members"   → blend_members     (+ profiles for display name / avatar)
 *   "room properties"→ room_properties   (our add-on table, integer property IDs)
 *   "votes"          → room_votes        (our add-on table, "like" | "dislike")
 *   "join requests"  → blend_join_requests
 *   "saved props"    → saved_properties  (our add-on table)
 */
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

// ── Guards & helpers ──────────────────────────────────────────────────────────
function guard() {
  if (!supabase) throw new Error("Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.");
}

export function isSchemaMissing(err) {
  if (!err) return false;
  const msg = (err?.message || err?.details || "").toLowerCase();
  return (
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("relation") ||
    err?.code === "PGRST200" ||
    err?.code === "42P01"
  );
}

async function safeQuery(fn, fallback, label = "query") {
  try {
    return await fn();
  } catch (err) {
    if (isSchemaMissing(err)) {
      console.warn(`[HomeBlend] DB table missing for "${label}" — run migration 005_homeblend_addon_tables.sql`);
      return fallback;
    }
    throw err;
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function signUp(email, password, displayName) {
  guard();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { display_name: displayName || email.split("@")[0] } },
  });
  if (error) throw error;
  // Upsert profile as safety net (trigger may not have run yet)
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
  guard();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase?.auth.signOut();
}

// ── Profiles ──────────────────────────────────────────────────────────────────
export async function fetchProfile(userId) {
  guard();
  return safeQuery(async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    return data;
  }, null, "fetchProfile");
}

export async function ensureProfile(userId, displayName) {
  guard();
  const fallback = { id: userId, display_name: displayName || "User", avatar_color: randomAvatarColor() };
  return safeQuery(async () => {
    const { data, error } = await supabase.from("profiles")
      .upsert({ id: userId, display_name: displayName || "User", avatar_color: randomAvatarColor() }, { onConflict: "id" })
      .select().maybeSingle();
    if (error) {
      if (isSchemaMissing(error)) return fallback;
      // Already exists — fetch it
      const { data: existing } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      return existing || fallback;
    }
    return data || fallback;
  }, fallback, "ensureProfile");
}

export async function updateProfile(userId, updates) {
  guard();
  const { data, error } = await supabase.from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId).select().maybeSingle();
  if (error) throw error;
  return data;
}

// ── Saved Properties ──────────────────────────────────────────────────────────
export async function fetchSavedPropertyIds(userId) {
  guard();
  return safeQuery(async () => {
    const { data } = await supabase.from("saved_properties")
      .select("property_id").eq("user_id", userId);
    return (data || []).map(r => r.property_id);
  }, [], "fetchSavedPropertyIds");
}

export async function saveProperty(userId, propertyId) {
  guard();
  return safeQuery(() =>
    supabase.from("saved_properties")
      .upsert({ user_id: userId, property_id: propertyId }, { onConflict: "user_id,property_id" }),
    null, "saveProperty"
  );
}

export async function unsaveProperty(userId, propertyId) {
  guard();
  return safeQuery(() =>
    supabase.from("saved_properties")
      .delete().eq("user_id", userId).eq("property_id", propertyId),
    null, "unsaveProperty"
  );
}

// ── Rooms (blends) ────────────────────────────────────────────────────────────
// All room operations use the existing `blends` table.
// The join code = blends.invite_code (auto-generated by DB as 8-char uppercase).

/** Create a new room. Uses RPC (SECURITY DEFINER) to bypass RLS + auto-join creator. */
export async function createRoom(name, userId) {
  guard();
  // Try the RPC first
  const { data: rpcData, error: rpcErr } = await supabase.rpc("create_blend", {
    p_name: name || "My Room",
  });
  if (!rpcErr && rpcData?.[0]) {
    const b = rpcData[0];
    return { id: b.id, name: b.name, room_code: b.invite_code, invite_code: b.invite_code, created_by: b.created_by };
  }

  // Fallback: direct insert (works if RLS allows or RPC not deployed yet)
  const { data, error } = await supabase.from("blends")
    .insert({ name: name || "My Room", created_by: userId })
    .select().maybeSingle();
  if (error) {
    if (isSchemaMissing(error)) {
      throw new Error("Database not set up. Run migration 005_homeblend_addon_tables.sql in your Supabase SQL editor.");
    }
    throw error;
  }
  // Auto-join creator as owner
  await supabase.from("blend_members")
    .upsert({ blend_id: data.id, user_id: userId, role: "owner" }, { onConflict: "blend_id,user_id" });
  return { ...data, room_code: data.invite_code };
}

/** Look up a room by its invite code. */
export async function fetchRoom(inviteCode) {
  guard();
  return safeQuery(async () => {
    const { data } = await supabase.from("blends")
      .select("*").eq("invite_code", inviteCode.toUpperCase()).maybeSingle();
    return data ? { ...data, room_code: data.invite_code } : null;
  }, null, "fetchRoom");
}

/** All rooms the user is a member of, newest first. */
export async function fetchUserRooms(userId) {
  guard();
  return safeQuery(async () => {
    const { data, error } = await supabase.from("blend_members")
      .select("joined_at, blends(id, name, invite_code, created_by, created_at)")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false });
    if (error) throw error;
    return (data || [])
      .map(r => r.blends)
      .filter(Boolean)
      .map(b => ({ ...b, room_code: b.invite_code }));
  }, [], "fetchUserRooms");
}

/** Join (or re-join) a room. Upserts profile + blend_member row. */
export async function joinRoom(blendId, userId, displayName, avatarColor) {
  guard();
  return safeQuery(async () => {
    // Best-effort profile upsert — silently ignored if profiles table is missing
    try {
      await supabase.from("profiles").upsert(
        { id: userId, display_name: displayName || "Member", avatar_color: avatarColor || randomAvatarColor() },
        { onConflict: "id" }
      );
    } catch { /* profiles table not created yet */ }

    // This always runs — blend_members exists
    const { error } = await supabase.from("blend_members")
      .upsert({ blend_id: blendId, user_id: userId, role: "member" }, { onConflict: "blend_id,user_id" });
    if (error) throw error;
  }, undefined, "joinRoom");
}

export async function leaveRoom(blendId, userId) {
  guard();
  return safeQuery(() =>
    supabase.from("blend_members").delete().eq("blend_id", blendId).eq("user_id", userId),
    null, "leaveRoom"
  );
}

/** Fetch members — two separate queries so we survive if profiles table is missing. */
export async function fetchMembers(blendId) {
  guard();
  return safeQuery(async () => {
    const { data: members, error } = await supabase.from("blend_members")
      .select("id, blend_id, user_id, role, joined_at")
      .eq("blend_id", blendId)
      .order("joined_at");
    if (error) throw error;
    if (!members?.length) return [];

    // Best-effort profile lookup — silently falls back if table is missing
    let profileMap = {};
    try {
      const userIds = members.map(m => m.user_id);
      const { data: profs } = await supabase.from("profiles")
        .select("id, display_name, avatar_color").in("id", userIds);
      (profs || []).forEach(p => { profileMap[p.id] = p; });
    } catch { /* profiles table not created yet — use defaults */ }

    return members.map(m => ({
      ...m,
      auth_user_id: m.user_id,
      display_name: profileMap[m.user_id]?.display_name || "Member",
      avatar_color: profileMap[m.user_id]?.avatar_color || "#A67C3D",
    }));
  }, [], "fetchMembers");
}

// ── Room Properties (our add-on table, integer mock IDs) ─────────────────────
export async function addPropertyToRoom(blendId, propertyId, userId) {
  guard();
  return safeQuery(async () => {
    const { error } = await supabase.from("room_properties").upsert(
      { blend_id: blendId, property_id: propertyId, added_by: userId },
      { onConflict: "blend_id,property_id" }
    );
    if (error) throw error;
  }, undefined, "addPropertyToRoom");
}

export async function removePropertyFromRoom(blendId, propertyId) {
  guard();
  return safeQuery(() =>
    supabase.from("room_properties")
      .delete().eq("blend_id", blendId).eq("property_id", propertyId),
    null, "removePropertyFromRoom"
  );
}

export async function fetchRoomProperties(blendId) {
  guard();
  return safeQuery(async () => {
    const { data } = await supabase.from("room_properties")
      .select("*").eq("blend_id", blendId).order("added_at");
    return (data || []).map(r => ({ ...r, room_id: blendId }));
  }, [], "fetchRoomProperties");
}

// ── Votes (room_votes, "like" | "dislike") ────────────────────────────────────
// Internally stores "like"/"dislike" but normalises to +1/-1 for the blend algorithm.

export async function recordVote(blendId, userId, propertyId, vote) {
  guard();
  return safeQuery(async () => {
    if (vote === null) {
      await supabase.from("room_votes").delete()
        .eq("blend_id", blendId).eq("user_id", userId).eq("property_id", propertyId);
      return;
    }
    // Accept both numeric (1/-1) and text ("like"/"dislike")
    const voteText = (vote === 1 || vote === "like") ? "like" : "dislike";
    const { error } = await supabase.from("room_votes").upsert(
      { blend_id: blendId, user_id: userId, property_id: propertyId, vote: voteText },
      { onConflict: "blend_id,user_id,property_id" }
    );
    if (error) throw error;
  }, undefined, "recordVote");
}

export async function fetchVotes(blendId) {
  guard();
  return safeQuery(async () => {
    const { data } = await supabase.from("room_votes").select("*").eq("blend_id", blendId);
    // Normalise to +1/-1 so blendAlgorithm.js works without changes
    return (data || []).map(v => ({
      ...v,
      room_id:  blendId,
      vote:     v.vote === "like" ? 1 : -1,
      voteText: v.vote,
    }));
  }, [], "fetchVotes");
}

// ── Join Requests (blend_join_requests) ───────────────────────────────────────
export async function fetchJoinRequests(blendId) {
  guard();
  return safeQuery(async () => {
    const { data, error } = await supabase.from("blend_join_requests")
      .select("*").eq("blend_id", blendId).order("created_at", { ascending: false });
    if (error) throw error;
    // Normalise field names for RoomView compatibility
    return (data || []).map(r => ({
      ...r,
      display_name: r.email?.split("@")[0] || "User",
    }));
  }, [], "fetchJoinRequests");
}

export async function requestToJoin(blendId, userId, displayName) {
  guard();
  // Try the RPC first
  const blend = await fetchRoomByBlendId(blendId);
  if (!blend?.invite_code) return "pending";

  const { data, error } = await supabase.rpc("request_to_join", {
    p_invite_code: blend.invite_code,
  });
  if (!error) return data;

  // Fallback: direct insert
  const userEmail = (await supabase.auth.getUser()).data?.user?.email;
  const { error: e2 } = await supabase.from("blend_join_requests").upsert(
    { blend_id: blendId, user_id: userId, email: userEmail, status: "pending" },
    { onConflict: "blend_id,user_id" }
  );
  if (e2) throw e2;
  return "pending";
}

async function fetchRoomByBlendId(blendId) {
  if (!supabase) return null;
  const { data } = await supabase.from("blends").select("invite_code").eq("id", blendId).maybeSingle();
  return data;
}

export async function respondToJoinRequest(requestId, accept, blendId) {
  guard();
  // Try the RPC
  const { data, error } = await supabase.rpc("respond_join_request", {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (!error) return data;

  // Fallback: manual update
  const status = accept ? "accepted" : "declined";
  await supabase.from("blend_join_requests").update({ status }).eq("id", requestId);
  if (accept) {
    const { data: req } = await supabase.from("blend_join_requests").select("*").eq("id", requestId).maybeSingle();
    if (req) {
      await supabase.from("blend_members").upsert(
        { blend_id: req.blend_id, user_id: req.user_id, role: "member" },
        { onConflict: "blend_id,user_id" }
      );
    }
  }
  return status;
}

// ── Realtime subscriptions ────────────────────────────────────────────────────
export function subscribeToRoom(blendId, { onVotes, onProperties, onMembers }) {
  if (!supabase) return null;
  const channel = supabase.channel(`blend:${blendId}:collab`, {
    config: { broadcast: { self: true } },
  });

  if (onVotes) {
    channel.on("postgres_changes", {
      event: "*", schema: "public", table: "room_votes",
      filter: `blend_id=eq.${blendId}`,
    }, onVotes);
  }
  if (onProperties) {
    channel.on("postgres_changes", {
      event: "*", schema: "public", table: "room_properties",
      filter: `blend_id=eq.${blendId}`,
    }, onProperties);
  }
  if (onMembers) {
    channel.on("postgres_changes", {
      event: "*", schema: "public", table: "blend_members",
      filter: `blend_id=eq.${blendId}`,
    }, onMembers);
  }

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      console.log(`[HomeBlend] Realtime connected → blend ${blendId}`);
    }
  });

  return channel;
}

export function unsubscribeFromRoom(channel) {
  if (channel && supabase) supabase.removeChannel(channel);
}
