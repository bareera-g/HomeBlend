interface CompatibilityMatrixProps {
  matrix: Record<string, Record<string, number>>;
  userIds: string[];
  names: Record<string, string>;
  groupCompatibility: number;
}

export function CompatibilityMatrix({
  matrix,
  userIds,
  names,
  groupCompatibility,
}: CompatibilityMatrixProps) {
  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 space-y-4">
      <p className="text-slate-400 text-sm">Pairwise compatibility</p>
      <div className="grid gap-2" style={{ gridTemplateColumns: `auto repeat(${userIds.length}, 1fr)` }}>
        <div />
        {userIds.map((id) => (
          <div key={id} className="text-xs text-slate-400 truncate text-center" title={names[id]}>
            {names[id]?.slice(0, 8) ?? id.slice(0, 6)}
          </div>
        ))}
        {userIds.map((rowId) => (
          <div key={rowId} className="contents">
            <div className="text-xs text-slate-400 truncate self-center" title={names[rowId]}>
              {names[rowId]?.slice(0, 8) ?? rowId.slice(0, 6)}
            </div>
            {userIds.map((colId) => (
              <div
                key={colId}
                className="text-center py-1 rounded bg-white/5 text-white text-sm font-mono"
              >
                {rowId === colId ? "—" : matrix[rowId]?.[colId] ?? 0}%
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-white font-medium pt-2 border-t border-white/10">
        Group compatibility: <span className="text-emerald-400">{groupCompatibility}%</span>
      </p>
    </div>
  );
}
