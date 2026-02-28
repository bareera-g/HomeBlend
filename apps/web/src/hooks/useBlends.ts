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
        )
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
  userId: string
): Promise<{ id: string; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("blends")
    .insert({ name, created_by: userId })
    .select("id")
    .single();

  return { id: data?.id ?? "", error: error?.message ?? null };
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

export async function joinBlendByCode(
  inviteCode: string,
  userId: string
): Promise<{ blendId: string | null; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: blend, error: findErr } = await (supabase as any)
    .from("blends")
    .select("id")
    .eq("invite_code", inviteCode.toUpperCase())
    .single();

  if (findErr || !blend) return { blendId: null, error: "Blend not found" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: joinErr } = await (supabase as any)
    .from("blend_members")
    .upsert(
      { blend_id: blend.id, user_id: userId, role: "member" },
      { onConflict: "blend_id,user_id" }
    );

  return { blendId: blend.id, error: joinErr?.message ?? null };
}
