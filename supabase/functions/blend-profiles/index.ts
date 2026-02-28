import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALL_PROPERTIES = [
  { id: 1,  title: "Woodbury Townhome",        category: "Townhome",      beds: 3, baths: 2.5, priceNum: 3800, sqft: 1750, tags: ["Gated Community","2-Car Garage","Resort Pool"],        petFriendly: true },
  { id: 2,  title: "Northpark Square Apt",     category: "Apartment",     beds: 3, baths: 2,   priceNum: 2800, sqft: 1340, tags: ["Ground Floor","Pool & Fitness","Quiet Street"],        petFriendly: false },
  { id: 3,  title: "University Park Condo",    category: "Condo",         beds: 3, baths: 2,   priceNum: 2600, sqft: 1280, tags: ["Walk to UCI","Renovated","Greenbelts"],                petFriendly: true },
  { id: 4,  title: "Portola Heights Townhome", category: "Townhome",      beds: 3, baths: 3,   priceNum: 4100, sqft: 1920, tags: ["Rooftop Deck","New Construction","Trail Access"],      petFriendly: true },
  { id: 5,  title: "Quail Hill Retreat",       category: "Condo",         beds: 3, baths: 2,   priceNum: 3500, sqft: 1560, tags: ["Canyon Views","Hiking Adjacent","Concierge"],          petFriendly: true },
  { id: 6,  title: "Great Park Apartment",     category: "Apartment",     beds: 3, baths: 2,   priceNum: 3200, sqft: 1460, tags: ["Great Park Views","Modern Finishes","Dog-Friendly"],   petFriendly: true },
  { id: 7,  title: "Irvine Spectrum Apt",      category: "Apartment",     beds: 3, baths: 2,   priceNum: 3600, sqft: 1380, tags: ["Walk to Spectrum","Rooftop Lounge","EV Charging"],    petFriendly: false },
  { id: 8,  title: "Northwood Pointe Home",    category: "Single Family", beds: 3, baths: 2.5, priceNum: 4800, sqft: 2100, tags: ["Cul-de-Sac","Private Pool","Top Schools"],            petFriendly: true },
  { id: 9,  title: "Oak Creek Villas",         category: "Condo",         beds: 3, baths: 2,   priceNum: 2950, sqft: 1310, tags: ["End Unit","Pool & Tennis","Walk to Shops"],           petFriendly: false },
  { id: 10, title: "Turtle Rock Home",         category: "Single Family", beds: 3, baths: 2,   priceNum: 4500, sqft: 1920, tags: ["Canyon Views","Remodeled Kitchen","Quiet Street"],    petFriendly: true },
  { id: 11, title: "Oak Creek Family Home",    category: "Single Family", beds: 3, baths: 2,   priceNum: 3100, sqft: 1490, tags: ["Cul-de-Sac","Updated Kitchen","Community Tennis"],    petFriendly: true },
  { id: 12, title: "Stonegate Modern Condo",   category: "Condo",         beds: 3, baths: 2,   priceNum: 2950, sqft: 1410, tags: ["Smart Thermostat","EV Charging Ready","Pool & Spa"],  petFriendly: false },
  { id: 13, title: "Laguna Altura Home",       category: "Single Family", beds: 3, baths: 3,   priceNum: 4200, sqft: 2050, tags: ["Gated Community","Mountain Views","Spa Bath"],        petFriendly: true },
  { id: 14, title: "Columbus Grove Craftsman", category: "Townhome",      beds: 3, baths: 2.5, priceNum: 3300, sqft: 1640, tags: ["Attached Garage","Open Floor Plan","Dog Park Nearby"],petFriendly: true },
  { id: 15, title: "Central Park West",        category: "Apartment",     beds: 3, baths: 2,   priceNum: 2300, sqft: 1260, tags: ["Walk to Irvine Station","Rooftop Deck","Concierge"],  petFriendly: false },
];

async function callClaude(prompt: string): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-opus-4-5", max_tokens: 3500, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content[0].text;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const { roomId } = await req.json();
    if (!roomId) throw new Error("roomId required");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: members }, { data: roomProps }, { data: votes }] = await Promise.all([
      supabase.from("room_members").select("*").eq("room_id", roomId),
      supabase.from("room_properties").select("*").eq("room_id", roomId),
      supabase.from("votes").select("*").eq("room_id", roomId),
    ]);
    if (!members?.length) throw new Error("No members found");
    const candidateIds = new Set((roomProps || []).map((rp: any) => rp.property_id));
    const candidates = candidateIds.size > 0 ? ALL_PROPERTIES.filter(p => candidateIds.has(p.id)) : ALL_PROPERTIES;
    const memberSummaries = members.map((m: any) => {
      const userId = m.auth_user_id || m.user_id;
      const myVotes = (votes || []).filter((v: any) => v.user_id === userId);
      return { user_id: userId, display_name: m.display_name, upvoted: myVotes.filter((v: any) => v.vote === 1).map((v: any) => candidates.find(p => p.id === v.property_id)).filter(Boolean), downvoted: myVotes.filter((v: any) => v.vote === -1).map((v: any) => candidates.find(p => p.id === v.property_id)).filter(Boolean) };
    });
    const prompt = `You are a real estate AI helping roommates find their ideal rental in Irvine, CA.\n\nCANDIDATE PROPERTIES:\n${JSON.stringify(candidates, null, 2)}\n\nROOMMATE VOTES:\n${JSON.stringify(memberSummaries, null, 2)}\n\nAnalyze preferences and return ONLY valid JSON:\n{"member_profiles":[{"user_id":"...","lifestyle_summary":"2-sentence summary","key_values":["v1","v2","v3"],"price_preference":"budget|mid|premium"}],"property_scores":{"1":{"score":75,"reason":"..."}},"group_summary":"2-3 sentences","top_matches":[5,1,9],"compromise_notes":"1-2 sentences"}`;
    const raw = await callClaude(prompt);
    let result;
    try { result = JSON.parse(raw); } catch { const m = raw.match(/```(?:json)?\s*([\s\S]+?)```/); result = JSON.parse(m ? m[1].trim() : raw.trim()); }
    const scores: Record<number, any> = {};
    for (const [k, v] of Object.entries(result.property_scores || {})) scores[Number(k)] = v;
    result.property_scores = scores;
    return new Response(JSON.stringify(result), { headers: { ...CORS, "content-type": "application/json" } });
  } catch (err: any) {
    console.error("blend-profiles error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...CORS, "content-type": "application/json" } });
  }
});
