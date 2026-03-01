import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function geminiProxyPlugin() {
  let apiKey = "";

  return {
    name: "homeblend-gemini-proxy",
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), "");
      apiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || "";
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== "/api/gemini") return next();
        if (req.method === "OPTIONS") {
          res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type" });
          return res.end();
        }
        if (req.method !== "POST") {
          res.writeHead(405, { "content-type": "application/json" });
          return res.end(JSON.stringify({ error: "Method not allowed" }));
        }

        let body = "";
        for await (const chunk of req) body += chunk;

        const json = (status, obj) => {
          res.writeHead(status, { "content-type": "application/json" });
          res.end(JSON.stringify(obj));
        };

        if (!apiKey) return json(500, { error: "GEMINI_API_KEY is not set in .env.local — add it and restart the dev server" });

        try {
          const { prompt, maxTokens = 800 } = JSON.parse(body);
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
          const apiRes = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
            }),
          });

          if (!apiRes.ok) {
            const err = await apiRes.json().catch(() => ({}));
            // #region agent log
            const fs = await import("node:fs");
            fs.appendFileSync("/Users/bareeragulraiz/HomeBlend/.cursor/debug-276317.log", JSON.stringify({sessionId:"276317",runId:"post-fix",hypothesisId:"model-name",location:"vite.config.js:proxy",message:"Gemini API error detail",data:{status:apiRes.status,detail:err},timestamp:Date.now()})+"\n");
            // #endregion
            const s = apiRes.status;
            const msg = s === 400 ? "Invalid Gemini API key or malformed request"
                      : s === 401 || s === 403 ? "Gemini API key is invalid or unauthorized"
                      : s === 429 ? "Gemini rate limit exceeded — wait a moment and retry"
                      : `Gemini API error (${s})`;
            return json(s, { error: msg, detail: err });
          }

          const data = await apiRes.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
          // #region agent log
          const fs2 = await import("node:fs");
          fs2.appendFileSync("/Users/bareeragulraiz/HomeBlend/.cursor/debug-276317.log", JSON.stringify({sessionId:"276317",runId:"post-fix",hypothesisId:"model-name",location:"vite.config.js:proxy-success",message:"Gemini API success",data:{hasText:Boolean(text),textLen:text?.length},timestamp:Date.now()})+"\n");
          // #endregion
          return json(200, { text });
        } catch (e) {
          console.error("[homeblend-gemini-proxy]", e);
          return json(502, { error: "Failed to connect to Gemini API — check your network" });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react({
      include: ["**/*.jsx", "**/*.js"],
    }),
    geminiProxyPlugin(),
  ],
  define: {
    "process.env": {},
  },
  resolve: {
    extensions: [".jsx", ".js", ".ts", ".tsx"],
  },
});
