import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { LeaderboardTable } from "../components/LeaderboardTable";

const POLL_MS = 2000;

export default function HostLive() {
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<
    Array<{
      listingId: string;
      listing: Record<string, unknown>;
      yesCount: number;
      noCount: number;
      matchScore: number;
    }>
  >([]);

  useEffect(() => {
    const c = sessionStorage.getItem("homeblend_host_code");
    if (!c) navigate("/host/create", { replace: true });
    else setCode(c);
  }, [navigate]);

  useEffect(() => {
    if (!code) return;
    const fetchLeaderboard = () => {
      api.getLeaderboard(code, 10).then((r) => setLeaderboard(r.leaderboard)).catch(() => {});
    };
    fetchLeaderboard();
    const t = setInterval(fetchLeaderboard, POLL_MS);
    return () => clearInterval(t);
  }, [code]);

  const revealBlend = () => {
    if (!code) return;
    api.setStatus(code, "RESULTS").then(() => navigate("/host/blend")).catch(() => {});
  };

  if (!code) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">Live leaderboard</h1>
        <p className="text-slate-400 text-sm">Top matches update as people swipe.</p>
        <LeaderboardTable entries={leaderboard as Parameters<typeof LeaderboardTable>[0]["entries"]} />
        <button
          onClick={revealBlend}
          className="w-full py-3 rounded-xl bg-white/15 text-white font-medium hover:bg-white/20 transition"
        >
          Reveal Blend
        </button>
      </div>
    </div>
  );
}
