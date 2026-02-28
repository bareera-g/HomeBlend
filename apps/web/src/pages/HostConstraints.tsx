import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { ConstraintChips } from "../components/ConstraintChips";

const HARD_NO_OPTIONS = [
  { id: "no_parking", label: "No parking" },
  { id: "no_in_unit_laundry", label: "No in-unit laundry" },
];

export default function HostConstraints() {
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(null);
  const [rentOrBuy, setRentOrBuy] = useState<"RENT" | "BUY">("RENT");
  const [budgetMin, setBudgetMin] = useState(0);
  const [budgetMax, setBudgetMax] = useState(5000);
  const [bedsMin, setBedsMin] = useState(0);
  const [bathsMin, setBathsMin] = useState(0);
  const [location, setLocation] = useState("");
  const [hardNo, setHardNo] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = sessionStorage.getItem("homeblend_host_code");
    if (!c) navigate("/host/create", { replace: true });
    else setCode(c);
  }, [navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setSubmitting(true);
    setError(null);
    api
      .setConstraints(code, {
        rentOrBuy,
        budgetMin,
        budgetMax,
        bedsMin,
        bathsMin,
        location: location.trim(),
        hardNo,
      })
      .then(() => navigate("/host/lobby"))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setSubmitting(false));
  };

  if (!code) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Set constraints</h1>
        <p className="text-slate-400 mb-6">Filters for the listing pool</p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 space-y-4">
            <label className="block text-sm font-medium text-slate-300">Rent or buy</label>
            <div className="flex gap-4">
              {(["RENT", "BUY"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setRentOrBuy(opt)}
                  className={`flex-1 py-2 rounded-xl ${
                    rentOrBuy === opt ? "bg-white/20 text-white" : "bg-white/5 text-slate-400"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 space-y-4">
            <label className="block text-sm font-medium text-slate-300">Budget range</label>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                min={0}
                value={budgetMin}
                onChange={(e) => setBudgetMin(Number(e.target.value))}
                className="bg-white/10 rounded-xl px-4 py-2 text-white border border-white/10"
                placeholder="Min"
              />
              <input
                type="number"
                min={0}
                value={budgetMax}
                onChange={(e) => setBudgetMax(Number(e.target.value))}
                className="bg-white/10 rounded-xl px-4 py-2 text-white border border-white/10"
                placeholder="Max"
              />
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 space-y-4">
            <label className="block text-sm font-medium text-slate-300">Beds / Baths min</label>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                min={0}
                value={bedsMin}
                onChange={(e) => setBedsMin(Number(e.target.value))}
                className="bg-white/10 rounded-xl px-4 py-2 text-white border border-white/10"
                placeholder="Beds"
              />
              <input
                type="number"
                min={0}
                value={bathsMin}
                onChange={(e) => setBathsMin(Number(e.target.value))}
                className="bg-white/10 rounded-xl px-4 py-2 text-white border border-white/10"
                placeholder="Baths"
              />
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 space-y-4">
            <label className="block text-sm font-medium text-slate-300">Location (city/area)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-white/10 rounded-xl px-4 py-2 text-white border border-white/10"
              placeholder="e.g. San Francisco"
            />
          </div>
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 space-y-4">
            <label className="block text-sm font-medium text-slate-300">Hard dealbreakers</label>
            <ConstraintChips
              options={HARD_NO_OPTIONS}
              selected={hardNo}
              onChange={setHardNo}
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-white/15 text-white font-medium hover:bg-white/20 transition disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save and go to lobby"}
          </button>
        </form>
      </div>
    </div>
  );
}
