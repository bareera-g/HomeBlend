interface Entry {
  listingId: string;
  listing: {
    id: string;
    title: string;
    city: string;
    price: number;
    beds: number;
    baths: number;
    imageUrl: string;
  };
  yesCount: number;
  noCount: number;
  matchScore: number;
}

interface LeaderboardTableProps {
  entries: Entry[];
}

export function LeaderboardTable({ entries }: LeaderboardTableProps) {
  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <div
          key={entry.listingId}
          className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden flex flex-col sm:flex-row"
        >
          <div className="sm:w-40 flex-shrink-0">
            <img
              src={entry.listing.imageUrl}
              alt={entry.listing.title}
              className="w-full h-32 sm:h-full object-cover"
            />
          </div>
          <div className="flex-1 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-white font-semibold truncate">{entry.listing.title}</h3>
              <p className="text-slate-400 text-sm">
                {entry.listing.city} · ${entry.listing.price.toLocaleString()}/mo ·{" "}
                {entry.listing.beds} bed · {entry.listing.baths} bath
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-emerald-400 font-medium">♥ {entry.yesCount}</span>
              <span className="text-red-400/80">✕ {entry.noCount}</span>
              <span className="text-white font-mono">score {entry.matchScore.toFixed(1)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
