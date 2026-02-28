const BASE = "/api";

async function request<T>(
  path: string,
  options?: RequestInit & { params?: Record<string, string> }
): Promise<T> {
  const { params, ...init } = options ?? {};
  let url = BASE + path;
  if (params) {
    const search = new URLSearchParams(params).toString();
    url += (path.includes("?") ? "&" : "?") + search;
  }
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  createSession: () =>
    request<{ sessionCode: string; sessionId: string }>("/sessions", {
      method: "POST",
      body: "{}",
    }),

  setConstraints: (code: string, constraints: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/sessions/${code}/constraints`, {
      method: "POST",
      body: JSON.stringify(constraints),
    }),

  setStatus: (code: string, status: string) =>
    request<{ ok: boolean; status: string }>(`/sessions/${code}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  join: (code: string, name: string) =>
    request<{ userId: string }>(`/sessions/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  getState: (code: string) =>
    request<{
      sessionId: string;
      code: string;
      status: string;
      users: { id: string; name: string; isReady: boolean }[];
      swipeCounts: Record<string, number>;
    }>(`/sessions/${code}/state`),

  getListings: (code: string, userId: string, cursor?: string, limit?: number) => {
    const params: Record<string, string> = { userId };
    if (cursor) params.cursor = cursor;
    if (limit != null) params.limit = String(limit);
    return request<{ listings: Array<Record<string, unknown>>; nextCursor: string | null; total: number }>(
      `/sessions/${code}/listings`,
      { params }
    );
  },

  swipe: (code: string, userId: string, listingId: string, vote: "YES" | "NO" | "MAYBE") =>
    request<{ ok: boolean; swipeCount: number }>(`/sessions/${code}/swipe`, {
      method: "POST",
      body: JSON.stringify({ userId, listingId, vote }),
    }),

  ready: (code: string, userId: string, isReady: boolean) =>
    request<{ ok: boolean; isReady: boolean }>(`/sessions/${code}/ready`, {
      method: "POST",
      body: JSON.stringify({ userId, isReady }),
    }),

  getLeaderboard: (code: string, limit?: number) => {
    const params = limit != null ? { limit: String(limit) } : undefined;
    return request<{ leaderboard: Array<{ listingId: string; listing: Record<string, unknown>; yesCount: number; noCount: number; matchScore: number }> }>(
      `/sessions/${code}/leaderboard`,
      { params }
    );
  },

  getBlend: (code: string) =>
    request<{
      tasteVectors: Record<string, Record<string, number>>;
      compatibilityMatrix: Record<string, Record<string, number>>;
      groupCompatibility: number;
      conflicts: string[];
      insights: Array<{ userId?: string; bullets: string[] }>;
    }>(`/sessions/${code}/blend`),
};
