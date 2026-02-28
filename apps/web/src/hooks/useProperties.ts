import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { PropertyWithFloorplans } from "@homeblend/types";

export function useProperties(city?: string) {
  const [properties, setProperties] = useState<PropertyWithFloorplans[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from("properties")
      .select("*, floorplans(*)")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (city) query = query.eq("city", city);

    query.then(({ data, error: err }: { data: unknown; error: { message: string } | null }) => {
      if (err) {
        setError(err.message);
      } else {
        setProperties((data ?? []) as PropertyWithFloorplans[]);
      }
      setLoading(false);
    });
  }, [city]);

  return { properties, loading, error };
}
