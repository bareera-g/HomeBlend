import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { QRCodeCard } from "../components/QRCodeCard";
import { UserJoinList } from "../components/UserJoinList";

const POLL_MS = 1500;

export default function HostLobby() {
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(null);
  const [state, setState] = useState<{
    status: string;
    users: { id: string; name: string; isReady: boolean }[];
    swipeCounts: Record<string, number>;
  } | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = sessionStorage.getItem("homeblend_host_code");
    if (!c) navigate("/host/create", { replace: true });
    else setCode(c);
  }, [navigate]);

  useEffect(() => {
    if (!code) return;
    const fetchState = () => {
      api.getState(code).then(setState).catch(() => {});
    };
    fetchState();
    const t = setInterval(fetchState, POLL_MS);
    return () => clearInterval(t);
  }, [code]);

  const startSwiping = () => {
    if (!code) return;
    setStarting(true);
    setError(null);
    api
      .setStatus(code, "SWIPING")
      .then(() => navigate("/host/live"))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setStarting(false));
  };

  if (!code) return null;

  const joinUrl = `${window.location.origin}/m/${code}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">Lobby</h1>
        <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 space-y-4">
          <p className="text-slate-400 text-sm">Join code</p>
          <p className="text-3xl font-mono font-bold text-white tracking-widest">{code}</p>
          <QRCodeCard value={joinUrl} size={160} />
        </div>
        <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 space-y-4">
          <p className="text-slate-400 text-sm">Participants</p>
          {state?.users && state.users.length > 0 ? (
            <UserJoinList
              users={state.users}
              swipeCounts={state.swipeCounts}
              totalListings={50}
            />
          ) : (
            <p className="text-slate-500">Waiting for others to join...</p>
          )}
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          onClick={startSwiping}
          disabled={starting || !state?.users?.length}
          className="w-full py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {starting ? "Starting..." : "Start swiping"}
        </button>
      </div>
    </div>
  );
}
