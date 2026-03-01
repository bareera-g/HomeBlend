/**
 * HomeBlend — LLM utilities (Google Gemini via server proxy)
 * The API key is stored server-side as GEMINI_API_KEY in .env.local
 * and never shipped to the browser.
 */

export const isLLMReady = true;

// #region agent log
console.warn('[DBG-276317] llm.js:init',JSON.stringify({proxy:true,isLLMReady:true}));
fetch('http://127.0.0.1:7523/ingest/06aa0d71-7bf1-4955-8863-93af5e151c67',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'276317'},body:JSON.stringify({sessionId:'276317',runId:'post-fix',hypothesisId:'verify',location:'llm.js:init',message:'LLM module init (proxy mode)',data:{proxy:true},timestamp:Date.now()})}).catch(()=>{});
// #endregion

async function callGemini(prompt, maxTokens = 512) {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, maxTokens }),
  });

  let data;
  try { data = await res.json(); } catch { throw new Error("Invalid response from insights server"); }

  if (!res.ok) {
    // #region agent log
    console.warn('[DBG-276317] llm.js:callGemini-error',JSON.stringify({status:res.status,error:data?.error}));
    fetch('http://127.0.0.1:7523/ingest/06aa0d71-7bf1-4955-8863-93af5e151c67',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'276317'},body:JSON.stringify({sessionId:'276317',runId:'post-fix',hypothesisId:'verify',location:'llm.js:callGemini-error',message:'Proxy returned error',data:{status:res.status,error:data?.error},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw new Error(data?.error || `Server error (${res.status})`);
  }

  // #region agent log
  console.warn('[DBG-276317] llm.js:callGemini-success',JSON.stringify({hasText:Boolean(data?.text),textLength:data?.text?.length}));
  fetch('http://127.0.0.1:7523/ingest/06aa0d71-7bf1-4955-8863-93af5e151c67',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'276317'},body:JSON.stringify({sessionId:'276317',runId:'post-fix',hypothesisId:'verify',location:'llm.js:callGemini-success',message:'Proxy returned text',data:{hasText:Boolean(data?.text),textLength:data?.text?.length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

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
 * }
 */
export async function generateBlendAnalysis({ members, votes, properties, rankedProperties }) {
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

  const prompt = `You are analyzing apartment search behavior for a roommate group on HomeBlend.

MEMBERS (${members.length} people):
${memberSummaries.map(m => `- ${m.name}: Liked: [${m.liked || "none"}]. Disliked: [${m.disliked || "none"}]. Added ${m.addedCount} properties.`).join("\n")}

TOP VOTED PROPERTIES: ${topProps || "No votes yet"}

Respond ONLY with valid JSON (no markdown, no explanation) in this exact structure:
{
  "memberInsights": {
    ${memberSummaries.map(m => `"${m.id}": {"bullets": ["bullet 1 (max 12 words)", "bullet 2 (max 12 words)"], "summary": "one sentence about their style"}`).join(",\n    ")}
  },
  "compatibility": {
    "narrative": "2 sentences about the group dynamic",
    "works": ["1 shared value or strength", "another one"],
    "tensions": ["1 area of potential tension or difference"]
  },
  "topPick": "name of the property most likely to satisfy everyone, or empty string"
}`;

  const text = await callGemini(prompt, 800);
  if (!text) return null;
  return extractJSON(text, null);
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

  const prompt = `You are a roommate housing advisor for HomeBlend. Given member preferences and a set of rental properties, produce concise, named, first-person justifications.

MEMBERS:
${memberSummaries.map(m => `- ${m.name} (id: ${m.id}): Liked [${m.liked || "nothing yet"}]. Disliked [${m.disliked || "nothing yet"}].`).join("\n")}

PROPERTIES TO ANALYSE (in order of group preference):
${topProps.map(p => `- id:${p.id} "${p.title}" ${p.price}, ${p.beds}bd, tags:[${p.tags}], extras:[${p.extras}]`).join("\n")}

Respond ONLY with valid JSON (no markdown, no explanation) in EXACTLY this structure:
{
  ${topProps.map(p => `"${p.id}": {
    "narrative": "2 concise sentences explaining why this property suits (or doesn't suit) the group",
    "members": {
      ${memberSummaries.map(m => `"${m.id}": {"why": "one sentence why this works for ${m.name}, mentioning their name", "concern": "one sentence friction point for ${m.name} or empty string"}`).join(",\n      ")}
    }
  }`).join(",\n  ")}
}`;

  const text = await callGemini(prompt, 1200);
  if (!text) return null;
  return extractJSON(text, null);
}
