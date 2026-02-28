import { Link, useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1920')] bg-cover bg-center opacity-20" />
      <div className="relative z-10 max-w-md w-full space-y-12">
        <h1 className="text-5xl font-bold text-white text-center tracking-tight">
          HomeBlend
        </h1>
        <p className="text-slate-300 text-center text-lg">
          Find your perfect place together. Create a session or join with a code.
        </p>
        <div className="flex flex-col gap-4">
          <Link
            to="/host/create"
            className="w-full py-4 px-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white font-semibold text-lg text-center shadow-xl hover:bg-white/15 transition"
          >
            Create HomeBlend (Host)
          </Link>
          <button
            type="button"
            onClick={() => {
              const code = prompt("Enter session code:");
              if (code?.trim()) navigate(`/m/${code.trim().toUpperCase()}`);
            }}
            className="w-full py-4 px-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white font-semibold text-lg text-center shadow-xl hover:bg-white/15 transition"
          >
            Join (Mobile)
          </button>
        </div>
      </div>
    </div>
  );
}
