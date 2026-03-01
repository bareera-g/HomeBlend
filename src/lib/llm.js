/**
 * HomeBlend — LLM utilities (OpenAI via server proxy)
 * The API key is stored server-side as OPENAI_API_KEY in .env.local
 * and never shipped to the browser.
 */

export const isLLMReady = true;

async function callOpenAI(prompt, maxTokens = 512) {
  const res = await fetch("/api/openai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, maxTokens }),
  });

  let data;
  try { data = await res.json(); } catch { throw new Error("Invalid response from insights server"); }

  if (!res.ok) {
    throw new Error(data?.error || `Server error (${res.status})`);
  }

  return data.text;
}

function extractJSON(text, fallback) {
  try {
    const match = text?.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return fallback;
}

/**
 * Generate a full blend analysis for all members at once.
 * Returns:
 * {
 *   memberInsights: { [userId]: { bullets: string[], summary: string } },
 *   compatibility:  { narrative: string, works: string[], tensions: string[] },
 *   topPick:        string   (title of the group's best match)
 *   pairwiseCompat: { "id1|id2": { score: number, reason: string } } — AI-assessed pairwise compatibility with justification
 *   alternativePicks: Array<{ propertyId: number, reasoning: string }> — 6 properties NOT in room with AI reasoning
 * }
 */
export async function generateBlendAnalysis({ members, votes, properties, rankedProperties, allProperties = [], roomPropIds = [] }) {
  if (members.length === 0) return null;

  const memberSummaries = members.map(m => {
    const uid = m.auth_user_id;
    const liked = properties.filter(p =>
      votes.some(v => v.user_id === uid && v.property_id === p.id && v.vote === 1)
    );
    const disliked = properties.filter(p =>
      votes.some(v => v.user_id === uid && v.property_id === p.id && v.vote === -1)
    );
    const added = properties.filter(p =>
      votes.some(v => v.user_id === uid && v.property_id === p.id)
    );
    return {
      name: m.display_name,
      id: uid,
      liked: liked.map(p => `${p.title} ($${p.priceNum}/mo, ${p.beds}bd, ${p.tags?.slice(0,2).join("/")||""}, ${p.petFriendly?"pet-ok":""}, ${p.parking?"parking":""}`).join("; "),
      disliked: disliked.map(p => p.title).join("; "),
      addedCount: added.length,
    };
  });

  const topProps = (rankedProperties || []).slice(0, 5).map((r, i) =>
    `#${i+1} ${r.property.title} (score ${r.score > 0 ? "+" : ""}${r.score}, ${r.likes} likes, ${r.dislikes} dislikes)`
  ).join("; ");

  const roomSet = new Set(roomPropIds);
  const nonRoomProps = (allProperties || []).filter(p => !roomSet.has(p.id));
  const propListForAlternatives = nonRoomProps.slice(0, 50).map(p =>
    `[ID ${p.id}] ${p.title} | ${p.location} | ${p.price} | ${p.beds}bd | ${[p.petFriendly && "pets", p.parking && "parking", p.laundry === "In-unit" && "laundry"].filter(Boolean).join(", ")} | ${(p.tags || []).slice(0, 3).join(", ")}`
  ).join("\n");

  const pairKeys = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i].auth_user_id;
      const b = members[j].auth_user_id;
      pairKeys.push(`${a}|${b}`);
    }
  }

  const prompt = `You are a warm, insightful housing advisor who truly cares about helping roommate groups find a home where everyone feels seen and heard.

This isn't just an apartment search — it's about finding a place where ${members.map(m => m.display_name).join(", ")} can thrive together. Each person has brought something of themselves to this search. Your job is to reflect that back with empathy and precision.

MEMBERS AND THEIR VOICES (${members.length} people):
${memberSummaries.map(m => `- ${m.name} (id: ${m.id}): They loved [${m.liked || "nothing yet"}]. They passed on [${m.disliked || "nothing"}]. They've invested time adding ${m.addedCount} properties.`).join("\n")}

TOP VOTED PROPERTIES: ${topProps || "No votes yet"}

TONE REQUIREMENTS:
- memberInsights: AI-generate personalized insights based EXCLUSIVELY on their actual picks (properties they liked and passed on). Each bullet MUST reference a specific property they liked or passed on by name. Examples: "You gravitated toward Woodbury Townhome for its pet policy and resort pool." "Passing on Northpark Square suggests budget and in-unit laundry matter most." "Portola Heights caught your eye — rooftop deck and new construction align with your taste." Never give generic advice; every insight must tie to a property from their list. Bullets: max 15 words each. Summary: one sentence synthesizing what their picks reveal about their priorities.
- compatibility narrative: Paint a picture of this group's dynamic. Name specific strengths and tensions. Sound human.
- works/tensions: Be specific. Reference actual preferences from the data.
- pairwiseCompat: For EACH pair of members, assess compatibility 0-100 based on how aligned their LIKES and DISLIKES are. Provide a 1-sentence reason explaining why you gave that score. Consider: Do they like similar properties? Pass on similar ones? Key: "userId1|userId2" (order doesn't matter).
- alternativePicks: Select exactly 6 properties from the list below that are NOT already in the room. For EACH pick, "reasoning" is CRITICAL: write a MINIMUM of 2 full sentences, ideally 3. Never write just one sentence. The reasoning must feel deeply personalized — mention EVERY member by name (${members.map(m => m.display_name).join(", ")}). For each person, write a full sentence explaining WHY this property speaks to what they liked or what they passed on. Connect specific amenities/features to their actual votes. Example format: "${members[0]?.display_name || "Sarah"} loved [property X] for its pet policy, and this one allows dogs — same draw. ${members[1]?.display_name || "Alex"} passed on places without in-unit laundry, and this has it. ${members[2]?.display_name || "Jordan"} gravitated toward new builds; the 2022 construction here matches that." Make it feel like you studied each person's picks. Use exact property IDs from the list.

PROPERTIES NOT IN ROOM (choose 6):
${propListForAlternatives || "(none available)"}

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "memberInsights": {
    ${memberSummaries.map(m => `"${m.id}": {"bullets": ["insight referencing a specific property ${m.name} liked or passed on", "another insight tied to another pick"], "summary": "one sentence synthesizing what their picks reveal"}`).join(",\n    ")}
  },
  "compatibility": {
    "narrative": "2-3 empathetic sentences",
    "works": ["shared value 1", "shared value 2"],
    "tensions": ["area of difference"]
  },
  "topPick": "exact property title or empty string",
  "pairwiseCompat": {
    ${pairKeys.map(k => `"${k}": {"score": 0-100, "reason": "one sentence justifying this compatibility score"}`).join(",\n    ")}
  },
  "alternativePicks": [
    {"propertyId": 1, "reasoning": "MINIMUM 2-3 full sentences. First sentence: why this fits [member1]'s likes (name a property they liked and the feature). Second sentence: why it works for [member2] (their preference). Third sentence if room: [member3]'s fit. Never one sentence only."},
    ...exactly 6 items, all with propertyIds from the list above, NONE from the room
  ]
}`;

  const text = await callOpenAI(prompt, 3500);
  if (!text) return null;
  const parsed = extractJSON(text, null);
  if (!parsed) return null;
  return {
    ...parsed,
    pairwiseCompat: parsed.pairwiseCompat || {},
    alternativePicks: Array.isArray(parsed.alternativePicks) ? parsed.alternativePicks.slice(0, 6) : [],
  };
}

/**
 * Generate per-property group picks analysis.
 * Returns a map keyed by property id:
 * {
 *   [propertyId]: {
 *     narrative: string,
 *     members: {
 *       [userId]: { why: string, concern: string }
 *     }
 *   }
 * }
 */
export async function generatePicksAnalysis({ members, votes, properties, scoredProperties }) {
  if (members.length === 0 || properties.length === 0) return null;

  const memberSummaries = members.map(m => {
    const uid = m.auth_user_id;
    const liked    = properties.filter(p => votes.some(v => v.user_id === uid && v.property_id === p.id && v.vote === 1));
    const disliked = properties.filter(p => votes.some(v => v.user_id === uid && v.property_id === p.id && v.vote === -1));
    return {
      id: uid,
      name: m.display_name,
      liked:    liked.map(p => `${p.title} (${p.price}, ${p.beds}bd${p.petFriendly ? ", pets" : ""}${p.parking ? ", parking" : ""})`).join("; "),
      disliked: disliked.map(p => p.title).join("; "),
    };
  });

  const topProps = (scoredProperties || []).slice(0, 6).map(({ property }) => ({
    id: property.id,
    title: property.title,
    price: property.price,
    beds: property.beds,
    tags: property.tags?.slice(0, 3).join(", "),
    extras: [property.petFriendly && "pets ok", property.parking && "parking", property.laundry === "In-unit" && "in-unit laundry"].filter(Boolean).join(", "),
  }));

  const prompt = `You are an empathetic housing advisor helping ${memberSummaries.map(m => m.name).join(", ")} evaluate their top property picks. Your insights should feel personal — as if you've studied each person's preferences and are speaking directly to them.

MEMBERS (understand what moves each one):
${memberSummaries.map(m => `- ${m.name} (id: ${m.id}): They gravitated toward [${m.liked || "nothing yet"}]. They stepped back from [${m.disliked || "nothing"}]. Use this to personalize your "why" and "concern" for each property.`).join("\n")}

PROPERTIES TO ANALYSE (in order of group preference):
${topProps.map(p => `- id:${p.id} "${p.title}" ${p.price}, ${p.beds}bd, tags:[${p.tags}], extras:[${p.extras}]`).join("\n")}

WRITING REQUIREMENTS:
- narrative: 2 sentences that feel like a friend's honest take. "This place could really work because..." or "There's something here for everyone, especially..." Be specific about which preferences it hits. If there's a real drawback, say so with care.
- For each member's "why": Speak to ${memberSummaries.map(m => m.name).join(", ")} by name. Connect a concrete feature (price, beds, pets, parking, vibe) to what they liked. E.g., "${memberSummaries[0]?.name || "They"} — this hits your sweet spot for [X] because..."
- For each member's "concern": Only mention something if it's real. If a person loved pet-friendly places and this one isn't, that's a concern. If they prioritized budget and this is at the high end, note it. Otherwise use "".

Respond ONLY with valid JSON (no markdown, no explanation):
{
  ${topProps.map(p => `"${p.id}": {
    "narrative": "2 warm, specific sentences — why this could work for the group, what the trade-offs are",
    "members": {
      ${memberSummaries.map(m => `"${m.id}": {"why": "one sentence to ${m.name} — why this property speaks to what they've shown they want, use their name", "concern": "one honest sentence about a real friction point for ${m.name}, or empty string if none"}`).join(",\n      ")}
    }
  }`).join(",\n  ")}
}`;

  const text = await callOpenAI(prompt, 1200);
  if (!text) return null;
  return extractJSON(text, null);
}

/**
 * Generate AI overview (common ground + what to look for) and 10 curated picks
 * from a pool of 30 properties. Brief justification for each.
 *
 * Returns:
 * {
 *   overview: { commonGround: string, lookingFor: string },
 *   picks: Array<{ propertyId: number, aiSuggestion: string, inBlend: boolean }>
 * }
 */
export async function generateGroupPicksWithOverview({ members, votes, roomProperties, allProperties, scoredProperties }) {
  if (members.length === 0) return null;
  const allProps = allProperties || roomProperties || [];
  if (allProps.length === 0) return null;

  const roomPropIds = new Set((roomProperties || []).map(p => p.id));

  const memberSummaries = members.map(m => {
    const uid = m.auth_user_id;
    const liked = (roomProperties || []).filter(p =>
      votes.some(v => v.user_id === uid && v.property_id === p.id && v.vote === 1)
    );
    const disliked = (roomProperties || []).filter(p =>
      votes.some(v => v.user_id === uid && v.property_id === p.id && v.vote === -1)
    );
    return {
      id: uid,
      name: m.display_name,
      liked: liked.map(p => ({
        id: p.id,
        title: p.title,
        price: p.price,
        amenities: [p.petFriendly && "pets", p.parking && "parking", p.laundry === "In-unit" && "in-unit laundry"].filter(Boolean),
        tags: p.tags || [],
        aiOverview: p.aiOverview || "",
      })),
      disliked: disliked.map(p => p.title),
    };
  });

  const propertyPayload = allProps.map(p => ({
    id: p.id,
    title: p.title,
    location: p.location,
    price: p.price,
    priceNum: p.priceNum,
    beds: p.beds,
    baths: p.baths,
    sqft: p.sqft,
    category: p.category,
    tags: (p.tags || []).join(", "),
    amenities: [p.petFriendly && "Pets OK", p.parking && `Parking: ${p.parking}`, p.laundry && `Laundry: ${p.laundry}`].filter(Boolean).join("; "),
    aiOverview: (p.aiOverview || "").trim(),
    inRoom: roomPropIds.has(p.id),
  }));

  const topVoted = (scoredProperties || [])
    .slice(0, 8)
    .map(s => ({ id: s.property.id, score: s.avgScore, likes: s.likes, sharedWorks: s.sharedWorks }));

  const prompt = `You are a trusted housing advisor who has listened carefully to ${memberSummaries.map(m => m.name).join(", ")}. They've shared what they love and what they've passed on. Your job is to reflect that back — to show them you understand, and to surface homes that genuinely fit.

MEMBERS AND THEIR PREFERENCES:
${memberSummaries.map(m => `
- ${m.name} (id: ${m.id}):
  LIKED: ${m.liked.length ? m.liked.map(p => `${p.title} ($${p.price}, ${p.amenities?.join(", ") || ""}, tags: ${(p.tags || []).slice(0, 3).join(", ")})`).join(" | ") : "none"}
  ${m.liked.length ? "Why they might love these: " + m.liked.map(p => p.aiOverview?.slice(0, 120) || "").join(" ... ") : ""}
  DISLIKED: ${m.disliked.length ? m.disliked.join(", ") : "none"}
`).join("\n")}

ALL AVAILABLE PROPERTIES (65 total — choose the 10 that fit this group best):
${propertyPayload.map(p => `
[ID ${p.id}] ${p.title}
  Location: ${p.location} | ${p.price} | ${p.beds}bd ${p.baths}ba | ${p.sqft} sqft | ${p.category}
  Tags: ${p.tags}
  Amenities: ${p.amenities}
  Pre-loaded AI overview: ${p.aiOverview ? p.aiOverview : "(none)"}
  In room: ${p.inRoom}
`).join("\n")}

TOP VOTED IN ROOM: ${topVoted.map(t => `#${t.id} (${t.score}% match, ${t.likes} likes)`).join(", ") || "none yet"}

TASK (write with warmth and precision):

1. OVERVIEW — "commonGround": 2-3 sentences that name this group and what unites them. Reference specific things they liked. Sound like you've been paying attention. "lookingFor": 2-3 sentences on what to prioritize — be specific (price band, must-haves, vibe). Speak to them as people, not a dataset.

2. Select exactly 10 PICKS from the 65 available. Choose properties that genuinely match what they've shown they want. Mix room properties (inBlend: true) with fresh discoveries (inBlend: false). Order by fit — best first.

3. For each pick, write "aiSuggestion" — a 1-2 sentence explanation that feels personal and transparent. Start with "We're showing you this because..." or "This made the list because..." or "You're seeing this one because...". Be explicit: name which preferences it matches, which member(s) it speaks to, or why it fits their lifestyle. The user should feel understood, not algorithmically served.

4. Mark "inBlend" true if the property is already in the room, false if it's a new suggestion.

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "overview": {
    "commonGround": " empathetic 2-3 sentences — what this group shares, named and specific ",
    "lookingFor": " 2-3 sentences — what to prioritize, tailored to their preferences "
  },
  "picks": [
    { "propertyId": 1, "aiSuggestion": " 1-2 sentences: We're showing this because... [specific reasons tied to their likes] ", "inBlend": true },
    ...exactly 10 items
  ]
}`;

  const text = await callOpenAI(prompt, 2500);
  if (!text) return null;
  const parsed = extractJSON(text, null);
  if (!parsed?.picks?.length) return null;
  return {
    overview: parsed.overview || { commonGround: "", lookingFor: "" },
    picks: parsed.picks.slice(0, 10),
  };
}
