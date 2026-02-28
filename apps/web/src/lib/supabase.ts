import { createClient } from "@supabase/supabase-js";
import type { Database } from "@homeblend/types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. " +
    "Configure these in apps/web/.env.local"
  );
}

/**
 * Browser-side Supabase client using the public anon key.
 * Safe to use in the browser — access is controlled by Row Level Security policies.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
