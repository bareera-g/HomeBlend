import { useEffect, useRef, useState } from "react";
import { createBlend } from "../hooks/useBlends";

interface Props {
  /** Pre-filled hint shown as placeholder (e.g. derived from a dropped property) */
  nameSuggestion?: string;
  onCreated: (blendId: string) => void;
  onCancel: () => void;
}

export default function CreateRoomIsland({ nameSuggestion, onCreated, onCancel }: Props) {
  const [name, setName]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Please enter a room name."); return; }
    setLoading(true);
    setError(null);
    const { id, error: err } = await createBlend(trimmed);
    setLoading(false);
    if (err) { setError(err); return; }
    onCreated(id);
  }

  return (
    /* Full-page overlay */
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/30 backdrop-blur-[3px]">
      {/* Island card */}
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#A67C52] to-[#c9a87c]" />

        <div className="px-6 pt-6 pb-7">
          {/* Heading */}
          <p className="text-[11px] font-semibold text-[#A67C52] uppercase tracking-widest mb-1">Collaborative</p>
          <h3 className="text-xl font-bold text-stone-900 mb-5">New Room</h3>

          {/* Name input */}
          <div className="mb-5">
            <label className="text-[11px] font-medium text-stone-400 uppercase tracking-wide block mb-1.5">
              Room name
            </label>
            <div className="flex items-center gap-2 bg-[#FFF2E1] border border-[#d4c4ae] rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-[#A67C52]/40 transition-shadow">
              <input
                ref={inputRef}
                type="text"
                placeholder={nameSuggestion ?? "e.g. Irvine Search 2025"}
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") onCancel(); }}
                maxLength={40}
                className="flex-1 bg-transparent text-sm font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none"
              />
              <span className="text-[10px] text-stone-400 shrink-0">{name.length}/40</span>
            </div>
            {error && <p className="text-[11px] text-red-500 mt-1.5">{error}</p>}
          </div>

          {/* Actions */}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 rounded-2xl border border-[#d4c4ae] bg-white text-sm font-semibold text-stone-600 hover:bg-[#f5ece0] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={loading || !name.trim()}
              className="flex-[2] py-3 rounded-2xl bg-[#1C1008] text-white text-sm font-semibold hover:bg-stone-900 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <span className="text-base leading-none">+</span>
                  Create Room
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
