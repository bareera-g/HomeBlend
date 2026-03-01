/**
 * HomeBlend — LLM utilities (Anthropic Claude)
 * Key is loaded from VITE_ANTHROPIC_API_KEY in .env.local
 */

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
const MODEL   = "claude-3-haiku-20240307";

export const isLLMReady = Boolean(API_KEY);

async function callClaude(prompt, maxTokens = 512) {
  if (!API_KEY) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "anthropic-dangerous-allow-browser": "true",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[HomeBlend LLM] Error:", res.status, err);
      return null;
    }
    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch (e) {
    console.error("[HomeBlend LLM] Fetch error:", e);
    return null;
  }
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
  if (!API_KEY || members.length === 0) return null;

  // Build a compact data summary for the prompt
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

  const text = await callClaude(prompt, 800);
  if (!text) return null;
  return extractJSON(text, null);
}
