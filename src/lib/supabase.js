import { createClient } from "@supabase/supabase-js";

const url     = import.meta.env.VITE_SUPABASE_URL      || "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase        = url && anonKey ? createClient(url, anonKey) : null;
export const isSupabaseReady = Boolean(url && anonKey);

const AVATAR_COLORS = ["#A67C3D","#5C8A6B","#7B6FA0","#C0624A","#4A7EA0","#8A6B5C"];
export function randomAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function signUp(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (data.user) {
    await supabase.from("profiles").upsert({
      id: data.user.id, display_name: displayName || email.split("@")[0], avatar_color: randomAvatarColor(),
    });
  }
  return data;
}
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
export async function signOut() { await supabase?.auth.signOut(); }

// ── Profiles ──────────────────────────────────────────────────────────────────
export async function fetchProfile(userId) {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return data;
}
export async function ensureProfile(userId, displayName) {
  const existing = await fetchProfile(userId);
  if (existing) return existing;
  const { data } = await supabase.from("profiles")
    .insert({ id: userId, display_name: displayName || "User", avatar_color: randomAvatarColor() })
    .select().single();
  return data;
}

// ── Saved Properties ──────────────────────────────────────────────────────────
export async function fetchSavedPropertyIds(userId) {
  const { data } = await supabase.from("saved_properties").select("property_id").eq("user_id", userId);
  return (data || []).map(r => r.property_id);
}
export async function saveProperty(userId, propertyId) {
  await supabase.from("saved_properties")
    .upsert({ user_id: userId, property_id: propertyId }, { onConflict: "user_id,property_id" });
}
export async function unsaveProperty(userId, propertyId) {
  await supabase.from("saved_properties").delete().eq("user_id", userId).eq("property_id", propertyId);
}

// ── Rooms ─────────────────────────────────────────────────────────────────────
export async function createRoom(roomCode, userId) {
  const { data, error } = await supabase.from("rooms")
    .insert({ room_code: roomCode, created_by: userId || null }).select().single();
  if (error) throw error;
  return data;
}
export async function fetchRoom(roomCode) {
  const { data } = await supabase.from("rooms").select("*").eq("room_code", roomCode).single();
  return data;
}
export async function fetchUserRooms(userId) {
  const { data } = await supabase.from("room_members")
    .select("rooms(*)").eq("auth_user_id", userId).order("joined_at", { ascending: false });
  return (data || []).map(r => r.rooms).filter(Boolean);
}
export async function joinRoom(roomId, userId, displayName, avatarColor) {
  await supabase.from("room_members").upsert(
    { room_id: roomId, user_id: userId, auth_user_id: userId, display_name: displayName, avatar_color: avatarColor },
    { onConflict: "room_id,user_id" }
  );
}
export async function fetchMembers(roomId) {
  const { data } = await supabase.from("room_members").select("*").eq("room_id", roomId).order("joined_at");
  return data || [];
}

// ── Room Properties ───────────────────────────────────────────────────────────
export async function addPropertyToRoom(roomId, propertyId, userId) {
  await supabase.from("room_properties")
    .upsert({ room_id: roomId, property_id: propertyId, added_by: userId }, { onConflict: "room_id,property_id" });
}
export async function removePropertyFromRoom(roomId, propertyId) {
  await supabase.from("room_properties").delete().eq("room_id", roomId).eq("property_id", propertyId);
}
export async function fetchRoomProperties(roomId) {
  const { data } = await supabase.from("room_properties").select("*").eq("room_id", roomId).order("added_at");
  return data || [];
}

// ── Votes ─────────────────────────────────────────────────────────────────────
export async function recordVote(roomId, userId, propertyId, vote) {
  if (vote === null) {
    await supabase.from("votes").delete()
      .eq("room_id", roomId).eq("user_id", userId).eq("property_id", propertyId);
    return;
  }
  await supabase.from("votes").upsert(
    { room_id: roomId, user_id: userId, property_id: propertyId, vote },
    { onConflict: "room_id,user_id,property_id" }
  );
}
export async function fetchVotes(roomId) {
  const { data } = await supabase.from("votes").select("*").eq("room_id", roomId);
  return data || [];
}

// ── Blend ─────────────────────────────────────────────────────────────────────
export async function callBlend(roomId) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.functions.invoke("blend-profiles", { body: { roomId } });
  if (error) throw error;
  return data;
}
