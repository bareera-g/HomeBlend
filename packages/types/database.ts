// ─── Enums ────────────────────────────────────────────────────────────────────

export type ListingSource = "apartments" | "zillow" | "redfin" | "other";
export type BlendRole     = "owner" | "member";

// ─── Row shapes (what Supabase returns from SELECT) ────────────────────────────

export interface PropertyRow {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  city: string;
  state: string;
  source: ListingSource;
  source_url: string;
  external_id: string | null;
  status: string;
  last_checked_at: string | null;
  raw: Record<string, unknown>;
}

export interface FloorplanRow {
  id: string;
  created_at: string;
  updated_at: string;
  property_id: string;
  floorplan_name: string;
  beds: number;
  baths: number;
  sqft: number | null;
  rent: number;
  available_on: string | null;
  source: ListingSource;
  source_url: string;
  external_id: string | null;
  status: string;
  last_checked_at: string | null;
  raw: Record<string, unknown>;
}

export interface BlendRow {
  id: string;
  created_at: string;
  name: string;
  created_by: string;
  invite_code: string;
}

export interface BlendMemberRow {
  id: string;
  blend_id: string;
  user_id: string;
  role: BlendRole;
  joined_at: string;
}

export interface BlendPropertyRow {
  id: string;
  blend_id: string;
  property_id: string;
  added_by: string | null;
  added_at: string;
}

export type JoinRequestStatus = "pending" | "accepted" | "declined";

export interface BlendJoinRequestRow {
  id: string;
  blend_id: string;
  user_id: string;
  email: string | null;
  status: JoinRequestStatus;
  created_at: string;
}

// ─── Insert shapes (required fields only; defaults are optional) ───────────────

export interface PropertyInsert {
  id?: string;
  created_at?: string;
  updated_at?: string;
  name: string;
  city: string;
  state: string;
  source: ListingSource;
  source_url: string;
  external_id?: string | null;
  status?: string;
  last_checked_at?: string | null;
  raw?: Record<string, unknown>;
}

export interface FloorplanInsert {
  id?: string;
  created_at?: string;
  updated_at?: string;
  property_id: string;
  floorplan_name: string;
  beds: number;
  baths: number;
  sqft?: number | null;
  rent: number;
  available_on?: string | null;
  source: ListingSource;
  source_url: string;
  external_id?: string | null;
  status?: string;
  last_checked_at?: string | null;
  raw?: Record<string, unknown>;
}

export interface BlendInsert {
  id?: string;
  created_at?: string;
  name: string;
  created_by: string;
  invite_code?: string;
}

export interface BlendMemberInsert {
  id?: string;
  blend_id: string;
  user_id: string;
  role?: BlendRole;
  joined_at?: string;
}

export interface BlendPropertyInsert {
  id?: string;
  blend_id: string;
  property_id: string;
  added_by?: string | null;
  added_at?: string;
}

// ─── Update shapes (all fields optional) ──────────────────────────────────────

export type PropertyUpdate    = Partial<PropertyInsert>;
export type FloorplanUpdate   = Partial<FloorplanInsert>;
export type BlendUpdate       = Partial<BlendInsert>;

// ─── Supabase Database schema (used to type createClient<Database>()) ──────────

export interface Database {
  public: {
    Tables: {
      properties: {
        Row: PropertyRow;
        Insert: PropertyInsert;
        Update: PropertyUpdate;
      };
      floorplans: {
        Row: FloorplanRow;
        Insert: FloorplanInsert;
        Update: FloorplanUpdate;
      };
      blends: {
        Row: BlendRow;
        Insert: BlendInsert;
        Update: BlendUpdate;
      };
      blend_members: {
        Row: BlendMemberRow;
        Insert: BlendMemberInsert;
        Update: Partial<BlendMemberInsert>;
      };
      blend_properties: {
        Row: BlendPropertyRow;
        Insert: BlendPropertyInsert;
        Update: Partial<BlendPropertyInsert>;
      };
      blend_join_requests: {
        Row: BlendJoinRequestRow;
        Insert: { blend_id: string; user_id: string; email?: string | null; status?: JoinRequestStatus };
        Update: { status?: JoinRequestStatus };
      };
    };
    Enums: {
      listing_source: ListingSource;
    };
    Functions: Record<string, never>;
  };
}

// ─── Convenience helpers ───────────────────────────────────────────────────────

/** A property with its floorplans eagerly joined */
export interface PropertyWithFloorplans extends PropertyRow {
  floorplans: FloorplanRow[];
}

/** A blend_property row with the full property + floorplans joined */
export interface BlendPropertyWithProperty extends BlendPropertyRow {
  properties: PropertyWithFloorplans;
}

/** A blend with members, saved properties, and join requests fully joined */
export interface BlendWithDetails extends BlendRow {
  blend_members: BlendMemberRow[];
  blend_properties: BlendPropertyWithProperty[];
  blend_join_requests: BlendJoinRequestRow[];
}
