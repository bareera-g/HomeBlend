import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { BlendRadar } from "../components/BlendRadar";
import { CompatibilityMatrix } from "../components/CompatibilityMatrix";
import { InsightBullets } from "../components/InsightBullets";
import { LeaderboardTable } from "../components/LeaderboardTable";

interface TasteVector {
  naturalLight: number;
  parking: number;
  openKitchen: number;
  balcony: number;
  inUnitLaundry: number;
}

interface BlendData {
  tasteVectors: Record<string, TasteVector>;
  compatibilityMatrix: Record<string, Record<string, number>>;
  groupCompatibility: number;
  conflicts: string[];
  insights: Array<{ userId?: string; bullets: string[] }>;
}

export default function HostBlend() {
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(null);
  const [state, setState] = useState<{ users: { id: string; name: string }[] } | null>(null);
  const [blend, setBlend] = useState<BlendData | null>(null);
  const [leaderboard, setLeaderboard] = useState<
    Array<{ listingId: string; listing: Record<string, unknown>; yesCount: number; noCount: number; matchScore: number }>
  >([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    const c = sessionStorage.getItem("homeblend_host_code");
    if (!c) navigate("/host/create", { replace: true });
    else setCode(c);
  }, [navigate]);

  useEffect(() => {
    if (!code) return;
    api.getState(code).then((s) => setState(s));
    api.getBlend(code).then((data) => setBlend(data as unknown as BlendData));
    api.getLeaderboard(code, 10).then((r) => setLeaderboard(r.leaderboard));
  }, [code]);

  if (!code) return null;

  const names: Record<string, string> = {};
  state?.users?.forEach((u) => (names[u.id] = u.name));
  const userIds = state?.users?.map((u) => u.id) ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-white">Blend</h1>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <p className="text-slate-400 text-sm mb-2">Taste profile</p>
            {userIds.length > 0 && (
              <select
                value={selectedUserId ?? userIds[0]}
                onChange={(e) => setSelectedUserId(e.target.value || null)}
                className="mb-2 w-full bg-white/10 rounded-lg px-3 py-2 text-white border border-white/10 text-sm"
              >
                {userIds.map((id) => (
                  <option key={id} value={id}>
                    {names[id]}
                  </option>
                ))}
              </select>
            )}
            {blend && (
              <BlendRadar
                tasteVectors={blend.tasteVectors}
                userIds={userIds}
                names={names}
                selectedUserId={selectedUserId ?? userIds[0]}
              />
            )}
          </div>
          <div className="md:col-span-2">
            {blend && (
              <CompatibilityMatrix
                matrix={blend.compatibilityMatrix}
                userIds={userIds}
                names={names}
                groupCompatibility={blend.groupCompatibility}
              />
            )}
          </div>
        </div>

        {blend && blend.conflicts.length > 0 && (
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6">
            <p className="text-slate-400 text-sm mb-2">Conflicts to discuss</p>
            <div className="flex flex-wrap gap-2">
              {blend.conflicts.map((c, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-200 text-sm border border-amber-400/30"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {blend && (
          <div>
            <p className="text-slate-400 text-sm mb-2">Insights</p>
            <InsightBullets insights={blend.insights} names={names} />
          </div>
        )}

        <div>
          <p className="text-slate-400 text-sm mb-2">Top picks</p>
          <LeaderboardTable entries={leaderboard as Parameters<typeof LeaderboardTable>[0]["entries"]} />
        </div>
      </div>
    </div>
  );
}
