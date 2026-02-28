import { useParams } from "react-router-dom";
import { useCallback, useState } from "react";
import { api } from "../api/client";
import { SwipeDeck } from "../components/SwipeDeck";

interface Listing {
  id: string;
  title: string;
  city: string;
  price: number;
  beds: number;
  baths: number;
  imageUrl: string;
}

export default function MobileSwipe() {
  const { code } = useParams<{ code: string }>();
  const userId = sessionStorage.getItem("homeblend_user_id");
  const [markedDone, setMarkedDone] = useState(false);

  const fetchListings = useCallback(
    (cursor?: string) =>
      code && userId
        ? api.getListings(code, userId, cursor, 10).then((r) => ({
            listings: r.listings as unknown as Listing[],
            nextCursor: r.nextCursor,
            total: r.total,
          }))
        : Promise.resolve({ listings: [], nextCursor: null, total: 0 }),
    [code, userId]
  );

  const onSwipe = useCallback(
    (listingId: string, vote: "YES" | "NO" | "MAYBE") =>
      code && userId
        ? api.swipe(code, userId, listingId, vote).then(() => {})
        : Promise.resolve(),
    [code, userId]
  );

  const onDone = useCallback(() => {
    if (!code || !userId || markedDone) return;
    setMarkedDone(true);
    api.ready(code, userId, true).catch(() => {});
  }, [code, userId, markedDone]);

  if (!code || !userId) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-white">Missing session or user. Join again from the start.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 pb-8">
      <div className="max-w-md mx-auto">
        <SwipeDeck
          fetchListings={fetchListings}
          onSwipe={onSwipe}
          onDone={onDone}
        />
      </div>
    </div>
  );
}
