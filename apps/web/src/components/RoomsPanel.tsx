import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BlendWithDetails } from "@homeblend/types";

interface Props {
  blends: BlendWithDetails[];
  blendsLoading: boolean;
  dragPropertyId: string | null;
  dragOverBlendId: string | null;
  dropSuccessId: string | null;
  dragOverNewBlend: boolean;
  creatingFromDrop: boolean;
  newBlendName: string;
  joinCode: string;
  roomsLoading: boolean;
  onClose: () => void;
  onSetDragOverBlendId: (id: string | null) => void;
  onSetDragOverNewBlend: (v: boolean) => void;
  onDropOnBlend: (blendId: string) => void;
  onDropCreateBlend: () => void;
  onSetNewBlendName: (v: string) => void;
  onSetJoinCode: (v: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}

export default function RoomsPanel({
  blends,
  blendsLoading,
  dragPropertyId,
  dragOverBlendId,
  dropSuccessId,
  dragOverNewBlend,
  creatingFromDrop,
  newBlendName,
  joinCode,
  roomsLoading,
  onClose,
  onSetDragOverBlendId,
  onSetDragOverNewBlend,
  onDropOnBlend,
  onDropCreateBlend,
  onSetNewBlendName,
  onSetJoinCode,
  onCreateRoom,
  onJoinRoom,
}: Props) {
  const navigate = useNavigate();
  const [localNewName, setLocalNewName] = useState(newBlendName);

  function handleNameChange(v: string) {
    setLocalNewName(v);
    onSetNewBlendName(v);
  }

  return (
    <>
      {/* Backdrop */}
      {!dragPropertyId && (
        <div className="absolute inset-0 bg-black/10 z-20" onClick={onClose} />
      )}

      {/* Panel */}
      <div className="absolute top-0 right-0 bottom-0 w-[360px] bg-[#FFF2E1] z-30 flex flex-col animate-slide-in-right overflow-hidden shadow-2xl">

        {/* ── Header ── */}
        <div className="shrink-0 px-6 pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[#A67C52] uppercase tracking-widest mb-1">
                {dragPropertyId ? "Drag & Drop" : "Collaborative"}
              </p>
              <h2 className="text-2xl font-bold text-stone-900 leading-tight">
                {dragPropertyId ? "Drop into a Room" : "Your Rooms"}
              </h2>
            </div>
            {!dragPropertyId && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-stone-500 hover:bg-stone-50 transition-colors text-lg leading-none mt-1"
              >
                ×
              </button>
            )}
          </div>

          {/* Create / join controls */}
          {!dragPropertyId && (
            <div className="mt-4 space-y-2">
              {newBlendName !== "" && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Room name…"
                    value={localNewName.trim()}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onCreateRoom()}
                    className="flex-1 px-3 py-2 rounded-xl border border-[#d4c4ae] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#A67C52]/30"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={onCreateRoom}
                    disabled={roomsLoading || !localNewName.trim()}
                    className="px-4 py-2 rounded-xl bg-[#1C1008] text-white text-sm font-semibold hover:bg-stone-900 disabled:opacity-50 transition-colors shrink-0"
                  >
                    {roomsLoading ? "…" : "Create"}
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => { onSetNewBlendName(newBlendName === "" ? " " : ""); setLocalNewName(newBlendName === "" ? " " : ""); }}
                className="w-full py-2.5 rounded-xl bg-[#1C1008] hover:bg-stone-900 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <span className="text-base leading-none">+</span> Create Room
              </button>

              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  placeholder="ROOM CODE"
                  value={joinCode}
                  onChange={(e) => onSetJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && onJoinRoom()}
                  className="flex-1 px-3 py-2 rounded-xl border border-[#d4c4ae] bg-white text-xs font-semibold tracking-widest placeholder:tracking-widest placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#A67C52]/30"
                />
                <button
                  type="button"
                  onClick={onJoinRoom}
                  disabled={roomsLoading || !joinCode.trim()}
                  className="px-4 py-2 rounded-xl border border-[#d4c4ae] bg-white text-sm font-semibold text-[#A67C52] hover:bg-[#f5e4c8] disabled:opacity-50 transition-colors shrink-0"
                >
                  Join
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 h-px bg-[#e8d5b7] mx-4" />

        {/* ── Room list ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

          {/* Create-new-room drop zone — only visible while dragging */}
          {(dragPropertyId || creatingFromDrop) && (
            <div
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; onSetDragOverNewBlend(true); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) onSetDragOverNewBlend(false); }}
              onDrop={(e) => { e.preventDefault(); onDropCreateBlend(); }}
              className={`
                rounded-2xl border-2 border-dashed flex items-center justify-center gap-2.5
                transition-all duration-150 select-none
                ${creatingFromDrop
                  ? "h-16 border-[#A67C52] bg-[#f5e4c8]"
                  : dragOverNewBlend
                    ? "h-20 border-[#A67C52] bg-[#f5e4c8] scale-[1.02] shadow-md"
                    : "h-16 border-[#d4c4ae] bg-white/60 hover:border-[#A67C52] hover:bg-[#f5e4c8]"
                }
              `}
            >
              {creatingFromDrop ? (
                <span className="w-4 h-4 rounded-full border-2 border-[#A67C52] border-t-transparent animate-spin" />
              ) : (
                <>
                  <span className={`text-lg font-light leading-none ${dragOverNewBlend ? "text-[#A67C52]" : "text-stone-400"}`}>+</span>
                  <span className={`text-[12px] font-medium ${dragOverNewBlend ? "text-[#A67C52]" : "text-stone-400"}`}>
                    {dragOverNewBlend ? "Drop to create new room" : "Drop here to create new room"}
                  </span>
                </>
              )}
            </div>
          )}

          {blendsLoading ? (
            [...Array(2)].map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-[#f0dfc0] animate-pulse" />
            ))
          ) : blends.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-3xl mx-auto mb-3 shadow-sm">🏠</div>
              <p className="text-sm font-semibold text-stone-700">No rooms yet</p>
              <p className="text-xs text-stone-400 mt-1">Create a room to start collaborating.</p>
            </div>
          ) : (
            blends.map((blend) => {
              const isOver      = dragOverBlendId === blend.id;
              const isSuccess   = dropSuccessId   === blend.id;
              const props       = blend.blend_properties ?? [];
              const memberCount = blend.blend_members?.length ?? 0;

              return (
                <div
                  key={blend.id}
                  onClick={() => { if (!dragPropertyId) { onClose(); navigate(`/blend/${blend.id}`); } }}
                  onDragOver={dragPropertyId ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; onSetDragOverBlendId(blend.id); } : undefined}
                  onDragLeave={dragPropertyId ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) onSetDragOverBlendId(null); } : undefined}
                  onDrop={dragPropertyId ? (e) => { e.preventDefault(); onDropOnBlend(blend.id); } : undefined}
                  className={`bg-white rounded-2xl p-4 transition-all duration-150 ${
                    dragPropertyId ? "" : "cursor-pointer"
                  } ${
                    isSuccess     ? "ring-2 ring-emerald-400 scale-[1.01]"
                    : isOver      ? "ring-2 ring-[#A67C52] scale-[1.01] shadow-lg"
                    : dragPropertyId ? "ring-2 ring-dashed ring-[#d4c4ae]"
                    : "shadow-sm hover:shadow-md hover:ring-1 hover:ring-[#e8d5b7]"
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[#A67C52] flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900 text-[15px] uppercase tracking-wide truncate">
                          {blend.name}
                        </span>
                        {isSuccess ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 uppercase tracking-wide shrink-0">Added!</span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#f0dfc0] text-[#A67C52] uppercase tracking-wide shrink-0">
                            {(blend as Record<string, unknown>).invite_code as string ?? "ROOM"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {memberCount} member{memberCount !== 1 ? "s" : ""}&nbsp;&nbsp;
                        {props.length} {props.length === 1 ? "property" : "properties"}
                      </p>
                    </div>
                    {isOver && (
                      <span className="ml-auto text-xs font-semibold text-[#A67C52] shrink-0">Drop here</span>
                    )}
                  </div>

                  {/* Thumbnails */}
                  {props.length > 0 && (
                    <div className="flex gap-2">
                      {props.slice(0, 3).map((bp) => {
                        const img  = (bp.properties.raw as Record<string, unknown>)?.image_url as string | undefined;
                        const name = bp.properties.name ?? "";
                        return (
                          <div key={bp.id} className="relative flex-1 h-24 rounded-xl overflow-hidden bg-[#f0dfc0]">
                            {img && <img src={img} alt={name} className="w-full h-full object-cover" draggable={false} />}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                              <p className="text-white text-[10px] font-semibold leading-tight line-clamp-1">{name}</p>
                            </div>
                          </div>
                        );
                      })}
                      {props.length > 3 && (
                        <div className="w-10 h-24 rounded-xl bg-[#f0dfc0] flex items-center justify-center text-xs text-stone-500 font-bold shrink-0">
                          +{props.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
