interface User {
  id: string;
  name: string;
  isReady: boolean;
}

interface UserJoinListProps {
  users: User[];
  swipeCounts?: Record<string, number>;
  totalListings?: number;
}

export function UserJoinList({ users, swipeCounts = {}, totalListings = 50 }: UserJoinListProps) {
  return (
    <ul className="space-y-3">
      {users.map((u) => {
        const count = swipeCounts[u.id] ?? 0;
        const pct = totalListings > 0 ? Math.round((count / totalListings) * 100) : 0;
        return (
          <li
            key={u.id}
            className="flex items-center justify-between bg-white/5 backdrop-blur-md rounded-xl px-4 py-3 border border-white/10"
          >
            <span className="text-white font-medium">{u.name}</span>
            <div className="flex items-center gap-3">
              <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500/80 rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-slate-400 text-sm tabular-nums">
                {count}/{totalListings}
              </span>
              {u.isReady && (
                <span className="text-emerald-400 text-xs font-medium">Done</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
