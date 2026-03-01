import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      include: ["**/*.jsx", "**/*.js"],
    }),
    // Proxy Gemini API to avoid CORS when calling from the browser
    {
      name: "gemini-proxy",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.method !== "POST" || !req.url?.startsWith("/api/gemini")) return next();
          const model = new URL(req.url, "http://localhost").searchParams.get("model") || "gemini-1.5-flash";
          const key = process.env.VITE_GEMINI_API_KEY;
          if (!key) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "VITE_GEMINI_API_KEY not set on server" }));
            return;
          }
          let body = "";
          req.on("data", (chunk) => { body += chunk; });
          req.on("end", async () => {
            try {
              const geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body,
                }
              );
              const data = await geminiRes.json();
              res.writeHead(geminiRes.status, { "Content-Type": "application/json" });
              res.end(JSON.stringify(data));
            } catch (e) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: String(e.message) }));
            }
          });
        });
      },
    },
  ],
  define: {
    "process.env": {},
  },
  resolve: {
    extensions: [".jsx", ".js", ".ts", ".tsx"],
  },
});
