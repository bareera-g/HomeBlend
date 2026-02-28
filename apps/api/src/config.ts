const PORT = process.env.PORT ?? "3000";
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "[config] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. " +
    "Supabase features will not work until these are configured in apps/api/.env"
  );
}

export const config = {
  port: parseInt(PORT, 10),
  corsOrigin: CORS_ORIGIN,
  nodeEnv: process.env.NODE_ENV ?? "development",
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
};
