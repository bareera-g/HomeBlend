import { createClient } from "@supabase/supabase-js";
import type { Database } from "@homeblend/types";
import { config } from "../config";

/**
 * Server-side Supabase client using the service role key.
 * This bypasses Row Level Security — use only in trusted server code.
 */
export const supabase = createClient<Database>(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
