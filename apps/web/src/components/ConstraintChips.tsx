interface Option {
  id: string;
  label: string;
}

interface ConstraintChipsProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function ConstraintChips({ options, selected, onChange }: ConstraintChipsProps) {
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id));
    else onChange([...selected, id]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => toggle(opt.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${
            selected.includes(opt.id)
              ? "bg-rose-500/30 text-rose-200 border border-rose-400/50"
              : "bg-white/10 text-slate-300 border border-white/10 hover:bg-white/15"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
