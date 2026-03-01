/**
 * Bottom loading bar — starts fast, slows down near the end.
 * Creates the illusion of quicker loading.
 */
import { useState, useEffect, useRef } from "react";
import { B } from "../Brand.jsx";

/** Fake progress: 0 → ~95% with fast start, then slows. */
function fakeProgress(elapsedMs) {
  const t = elapsedMs / 1000;
  const p = 1 - Math.pow(0.3, t / 0.35); // fast initial, asymptote
  return Math.min(95, p * 95);
}

export default function LoadingBar({ loading }) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const startRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!loading) {
      // Loading finished — snap to 100% then clear
      setProgress(100);
      const t = setTimeout(() => {
        setDone(true);
      }, 280);
      return () => clearTimeout(t);
    }

    setDone(false);
    setProgress(0);
    startRef.current = Date.now();

    function tick() {
      const elapsed = Date.now() - startRef.current;
      const p = fakeProgress(elapsed);
      setProgress(p);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loading]);

  if (done) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: "max(14px, env(safe-area-inset-bottom, 14px))",
        paddingLeft: "max(14px, env(safe-area-inset-left, 0))",
        paddingRight: "max(14px, env(safe-area-inset-right, 0))",
        zIndex: 9999,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          height: 5,
          background: "rgba(166,124,61,0.18)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${B.gold} 0%, rgba(166,124,61,0.85) 100%)`,
            transition: progress === 100 ? "width 0.2s ease, opacity 0.25s ease" : "none",
            borderRadius: 3,
          }}
        />
      </div>
    </div>
  );
}
