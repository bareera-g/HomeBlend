import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useBlends, createBlend, addPropertyToBlend } from "../hooks/useBlends";
import type { BlendWithDetails } from "@homeblend/types";

interface Props {
  propertyId: string | null;
  onClose: () => void;
}

export default function AddToBlendModal({ propertyId, onClose }: Props) {
  const { user } = useAuth();
  const { blends, loading, reload } = useBlends();

  const [creating,   setCreating]   = useState(false);
  const [newName,    setNewName]    = useState("");
  const [saving,     setSaving]     = useState<string | null>(null);
  const [saved,      setSaved]      = useState<Set<string>>(new Set());
  const [formError,  setFormError]  = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId || !blends.length) return;
    const already = new Set(
      blends
        .filter((b) =>
          b.blend_properties?.some((bp) => bp.property_id === propertyId)
        )
        .map((b) => b.id)
    );
    setSaved(already);
  }, [blends, propertyId]);

  if (!propertyId) return null;

  async function handleSaveToBlend(blend: BlendWithDetails) {
    if (!user || !propertyId) return;
    setSaving(blend.id);
    const { error } = await addPropertyToBlend(blend.id, propertyId, user.id);
    setSaving(null);
    if (!error) {
      setSaved((prev) => new Set(prev).add(blend.id));
      reload();
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!user || !newName.trim() || !propertyId) return;
    setFormError(null);
    setSaving("new");

    const { id: blendId, error: createErr } = await createBlend(newName.trim());
    if (createErr) { setFormError(createErr); setSaving(null); return; }

    const { error: addErr } = await addPropertyToBlend(blendId, propertyId, user.id);
    setSaving(null);
    if (addErr) { setFormError(addErr); return; }

    setSaved((prev) => new Set(prev).add(blendId));
    setCreating(false);
    setNewName("");
    reload();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-[#e8d5b7]">
          <div>
            <h3 className="font-bold text-stone-900 text-base">Save to Blend</h3>
            <p className="text-xs text-stone-400 mt-0.5">Add this property to a shared album</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#FFF2E1] hover:bg-[#f0dfc0] flex items-center justify-center text-stone-500 text-lg leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* Blend list */}
        <div className="px-5 py-3 max-h-64 overflow-y-auto space-y-1.5">
          {loading ? (
            <div className="space-y-2 py-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-[#f0dfc0] animate-pulse" />
              ))}
            </div>
          ) : blends.length === 0 && !creating ? (
            <div className="py-6 text-center">
              <p className="text-sm text-stone-500">No blends yet. Create your first one below.</p>
            </div>
          ) : (
            blends.map((blend) => {
              const isSaved      = saved.has(blend.id);
              const isSavingThis = saving === blend.id;
              return (
                <button
                  key={blend.id}
                  type="button"
                  disabled={isSaved || !!saving}
                  onClick={() => handleSaveToBlend(blend)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left ${
                    isSaved
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-[#e8d5b7] bg-[#FFF2E1] hover:bg-[#f5e4c8]"
                  }`}
                >
                  <div>
                    <p className={`text-sm font-medium ${isSaved ? "text-emerald-700" : "text-stone-800"}`}>
                      {blend.name}
                    </p>
                    <p className="text-xs text-stone-400">
                      {blend.blend_properties?.length ?? 0} properties ·{" "}
                      {blend.blend_members?.length ?? 0} member{blend.blend_members?.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {isSavingThis ? (
                    <span className="w-4 h-4 border-2 border-[#A67C52] border-t-transparent rounded-full animate-spin" />
                  ) : isSaved ? (
                    <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Create new blend */}
        <div className="px-5 pb-5 pt-2 border-t border-[#e8d5b7]">
          {creating ? (
            <form onSubmit={handleCreate} className="space-y-2">
              <input
                type="text"
                autoFocus
                placeholder="Blend name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={60}
                className="w-full px-3 py-2.5 rounded-xl border border-[#e8d5b7] bg-[#FFF2E1] text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#A67C52]/40 focus:bg-white transition"
              />
              {formError && <p className="text-xs text-red-500">{formError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setCreating(false); setNewName(""); setFormError(null); }}
                  className="flex-1 py-2 rounded-xl border border-[#e8d5b7] text-sm text-stone-500 hover:bg-[#FFF2E1] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim() || saving === "new"}
                  className="flex-1 py-2 rounded-xl bg-[#A67C52] hover:bg-[#8B6843] text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving === "new" && (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  )}
                  Create & Save
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full py-2.5 rounded-xl border border-dashed border-stone-300 text-sm text-stone-500 hover:border-[#A67C52] hover:text-[#A67C52] hover:bg-[#A67C52]/5 flex items-center justify-center gap-2 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create a new Blend
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
