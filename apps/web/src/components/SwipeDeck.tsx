import { useState, useEffect, useCallback } from "react";
import { ListingCard } from "./ListingCard";

interface Listing {
  id: string;
  title: string;
  city: string;
  price: number;
  beds: number;
  baths: number;
  imageUrl: string;
}

interface SwipeDeckProps {
  fetchListings: (cursor?: string) => Promise<{ listings: Listing[]; nextCursor: string | null; total: number }>;
  onSwipe: (listingId: string, vote: "YES" | "NO" | "MAYBE") => Promise<void>;
  onDone?: () => void;
}

export function SwipeDeck({ fetchListings, onSwipe, onDone }: SwipeDeckProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<"left" | "right" | "middle" | null>(null);

  const loadMore = useCallback(
    async (cursor?: string) => {
      const { listings: next, nextCursor: nc, total: t } = await fetchListings(cursor);
      setListings((prev) => (cursor ? [...prev, ...next] : next));
      setNextCursor(nc);
      setTotal(t);
    },
    [fetchListings]
  );

  useEffect(() => {
    loadMore()
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, [loadMore]);

  const current = listings[index];
  const progress = index + (listings.length > 0 && index < listings.length ? 1 : 0);

  const handleVote = async (vote: "YES" | "NO" | "MAYBE") => {
    if (!current) return;
    setDirection(vote === "YES" ? "right" : vote === "NO" ? "left" : "middle");
    await onSwipe(current.id, vote);
    if (index + 1 >= listings.length && !nextCursor) {
      onDone?.();
      setIndex((i) => i + 1);
    } else if (index + 1 < listings.length) {
      setIndex((i) => i + 1);
    } else if (nextCursor) {
      const prevLen = listings.length;
      await loadMore(nextCursor);
      setIndex(prevLen); // first card of newly appended batch
    }
    setDirection(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-white/80">Loading listings...</p>
      </div>
    );
  }

  if (!current && progress >= total && total > 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-2xl font-semibold text-white">You're done!</p>
        <p className="text-slate-400">You've seen all {total} listings.</p>
        {onDone && (
          <button
            onClick={onDone}
            className="px-6 py-2 rounded-xl bg-white/15 text-white"
          >
            I'm done
          </button>
        )}
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-slate-400">No listings available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center text-slate-400 text-sm tabular-nums">
        {progress} / {total}
      </div>
      <div
        className={`transition-transform duration-300 ${
          direction === "left" ? "-translate-x-full opacity-0" : direction === "right" ? "translate-x-full opacity-0" : ""
        }`}
      >
        <ListingCard
          id={current.id}
          title={current.title}
          city={current.city}
          price={current.price}
          beds={current.beds}
          baths={current.baths}
          imageUrl={current.imageUrl}
        />
      </div>
      <div className="flex justify-center gap-6 pt-4">
        <button
          onClick={() => handleVote("NO")}
          className="w-14 h-14 rounded-full bg-red-500/20 border-2 border-red-400/50 text-red-300 flex items-center justify-center text-xl font-bold shadow-lg hover:scale-105 transition"
        >
          ✕
        </button>
        <button
          onClick={() => handleVote("MAYBE")}
          className="w-14 h-14 rounded-full bg-amber-500/20 border-2 border-amber-400/50 text-amber-300 flex items-center justify-center text-xl font-bold shadow-lg hover:scale-105 transition"
        >
          ?
        </button>
        <button
          onClick={() => handleVote("YES")}
          className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400/50 text-emerald-300 flex items-center justify-center text-xl font-bold shadow-lg hover:scale-105 transition"
        >
          ♥
        </button>
      </div>
    </div>
  );
}
