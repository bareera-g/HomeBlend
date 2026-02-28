import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { BlendWithDetails } from "@homeblend/types";

export function useBlends() {
  const [blends,  setBlends]  = useState<BlendWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: err } = await (supabase as any)
      .from("blends")
      .select(`
        *,
        blend_members(*),
        blend_properties(
          *,
          properties(*, floorplans(*))
        ),
        blend_join_requests(*)
      `)
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setBlends((data ?? []) as BlendWithDetails[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { blends, loading, error, reload: load };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createBlend(
  name: string,
): Promise<{ id: string; error: string | null }> {
  // Uses a security-definer RPC so the insert bypasses RLS.
  // RLS is still enforced on all SELECT / UPDATE / DELETE operations.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .rpc("create_blend", { p_name: name });

  if (error) console.error("[createBlend]", error);
  return { id: data ?? "", error: error?.message ?? null };
}

export async function addPropertyToBlend(
  blendId: string,
  propertyId: string,
  userId: string
): Promise<{ error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("blend_properties")
    .upsert(
      { blend_id: blendId, property_id: propertyId, added_by: userId },
      { onConflict: "blend_id,property_id" }
    );

  return { error: error?.message ?? null };
}

export async function removePropertyFromBlend(
  blendId: string,
  propertyId: string
): Promise<{ error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("blend_properties")
    .delete()
    .eq("blend_id", blendId)
    .eq("property_id", propertyId);

  return { error: error?.message ?? null };
}

/** Sends a join request to the blend owner instead of joining directly. */
export async function requestJoinBlend(
  inviteCode: string,
): Promise<{ blendId: string | null; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .rpc("request_join_blend", { p_invite_code: inviteCode });

  if (error) console.error("[requestJoinBlend]", error);
  return { blendId: data ?? null, error: error?.message ?? null };
}

/** Owner accepts or declines a pending join request. */
export async function respondToJoinRequest(
  requestId: string,
  accept: boolean,
): Promise<{ error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .rpc("respond_join_request", { p_request_id: requestId, p_accept: accept });

  if (error) console.error("[respondToJoinRequest]", error);
  return { error: error?.message ?? null };
}
