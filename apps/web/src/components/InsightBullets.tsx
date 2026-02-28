interface InsightBulletsProps {
  insights: Array<{ userId?: string; bullets: string[] }>;
  names: Record<string, string>;
}

export function InsightBullets({ insights, names }: InsightBulletsProps) {
  return (
    <div className="space-y-4">
      {insights.map((item) => (
        <div
          key={item.userId ?? "group"}
          className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4"
        >
          <p className="text-slate-400 text-sm mb-2">
            {item.userId ? names[item.userId] ?? "User" : "Group"}
          </p>
          <ul className="list-disc list-inside space-y-1 text-white/90 text-sm">
            {item.bullets.map((b, j) => (
              <li key={j}>{b}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
