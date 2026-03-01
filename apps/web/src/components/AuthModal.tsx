import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Mode = "signin" | "signup";

export default function AuthModal({ open, onClose }: Props) {
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const [mode,     setMode]     = useState<Mode>("signin");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password);

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (mode === "signup") {
      setSuccess(true);
    }
  }

  async function handleGoogle() {
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) setError(error);
  }

  function handleSwitch() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
    setSuccess(false);
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
        <div className="px-6 pt-6 pb-4 border-b border-[#e8d5b7]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-stone-900">
                {mode === "signin" ? "Welcome back" : "Create account"}
              </h2>
              <p className="text-sm text-stone-400 mt-0.5">
                {mode === "signin"
                  ? "Sign in to save your favourite blends"
                  : "Join HomeBlend to create & share blends"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#FFF2E1] hover:bg-[#f0dfc0] flex items-center justify-center text-stone-500 text-lg leading-none transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {success ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center text-3xl mx-auto">
                ✉️
              </div>
              <p className="font-semibold text-stone-800">Check your email</p>
              <p className="text-sm text-stone-500">
                We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-[#A67C52] hover:bg-[#8B6843] text-white text-sm font-semibold transition-colors"
              >
                Got it
              </button>
            </div>
          ) : (
            <>
              {/* Google OAuth */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl border border-[#e8d5b7] bg-white hover:bg-[#FFF2E1] text-sm font-medium text-stone-700 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#e8d5b7]" />
                <span className="text-xs text-stone-400">or</span>
                <div className="flex-1 h-px bg-[#e8d5b7]" />
              </div>

              {/* Email/password form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2.5 rounded-xl border border-[#e8d5b7] bg-[#FFF2E1] text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#A67C52]/40 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 rounded-xl border border-[#e8d5b7] bg-[#FFF2E1] text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#A67C52]/40 focus:bg-white transition"
                  />
                </div>

                {error && (
                  <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-[#A67C52] hover:bg-[#8B6843] text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading && (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  )}
                  {mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>

              {/* Toggle mode */}
              <p className="text-center text-sm text-stone-500">
                {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={handleSwitch}
                  className="text-[#A67C52] hover:text-[#8B6843] font-medium transition-colors"
                >
                  {mode === "signin" ? "Sign up" : "Sign in"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
