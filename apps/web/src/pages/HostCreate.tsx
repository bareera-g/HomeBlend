import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { QRCodeCard } from "../components/QRCodeCard";

export default function HostCreate() {
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .createSession()
      .then(({ sessionCode }) => {
        setCode(sessionCode);
        sessionStorage.setItem("homeblend_host_code", sessionCode);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to create session"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-white/80">Creating session...</p>
      </div>
    );
  }
  if (error || !code) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-red-400">{error ?? "No session code"}</p>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 rounded-xl bg-white/10 text-white"
        >
          Back
        </button>
      </div>
    );
  }

  const joinUrl = `${window.location.origin}/m/${code}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center p-6">
      <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl p-8 max-w-sm w-full space-y-6">
        <h2 className="text-2xl font-semibold text-white text-center">Session created</h2>
        <p className="text-slate-400 text-center text-sm">Share this code to join</p>
        <p className="text-4xl font-mono font-bold text-white text-center tracking-[0.3em]">
          {code}
        </p>
        <QRCodeCard value={joinUrl} />
        <button
          onClick={() => navigate("/host/constraints")}
          className="w-full py-3 rounded-xl bg-white/15 text-white font-medium hover:bg-white/20 transition"
        >
          Set constraints
        </button>
      </div>
    </div>
  );
}
