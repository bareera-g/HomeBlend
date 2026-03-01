import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function NavBar() {
  const { user, authLoading, signOut, openAuthModal } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="shrink-0 h-14 bg-white border-b border-[#e8d5b7] flex items-center px-5 gap-6 z-30">
      {/* Logo */}
      <Link
        to="/"
        className="flex items-center gap-2 font-bold text-stone-900 text-lg shrink-0 hover:opacity-80 transition-opacity"
      >
        <span className="w-7 h-7 bg-[#A67C52] rounded-lg flex items-center justify-center text-white text-sm">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        </span>
        HomeBlend
      </Link>

      {/* Tabs */}
      <div className="flex items-center gap-1 flex-1">
        <Link
          to="/"
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
            isActive("/")
              ? "bg-stone-900 text-white"
              : "text-stone-500 hover:text-stone-800 hover:bg-[#FFF2E1]"
          }`}
        >
          Discover
        </Link>

        {!authLoading && user && (
          <Link
            to="/blend"
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              isActive("/blend")
                ? "bg-stone-900 text-white"
                : "text-stone-500 hover:text-stone-800 hover:bg-[#FFF2E1]"
            }`}
          >
            Blend
          </Link>
        )}
      </div>

      {/* Auth section */}
      {authLoading ? (
        <div className="w-8 h-8 rounded-full bg-[#FFF2E1] animate-pulse" />
      ) : user ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-[#FFF2E1] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[#A67C52] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {(user.email?.[0] ?? "U").toUpperCase()}
            </div>
            <span className="text-sm text-stone-700 max-w-[120px] truncate hidden sm:block">
              {user.email}
            </span>
            <svg
              className={`w-4 h-4 text-stone-400 transition-transform ${menuOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-[#e8d5b7] py-1 z-20">
                <div className="px-3 py-2 border-b border-[#FFF2E1]">
                  <p className="text-xs text-stone-400">Signed in as</p>
                  <p className="text-sm font-medium text-stone-800 truncate">{user.email}</p>
                </div>
                <Link
                  to="/blend"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-stone-700 hover:bg-[#FFF2E1] transition-colors"
                >
                  <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  My Blends
                </Link>
                <button
                  type="button"
                  onClick={() => { signOut(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={openAuthModal}
          className="px-4 py-2 rounded-xl bg-[#A67C52] hover:bg-[#8B6843] text-white text-sm font-semibold transition-colors shadow-sm"
        >
          Sign in
        </button>
      )}
    </nav>
  );
}
