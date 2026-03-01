import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function openaiProxyPlugin() {
  let apiKey = "";

  return {
    name: "homeblend-openai-proxy",
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), "");
      apiKey = env.OPENAI_API_KEY || "";
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== "/api/llm") return next();
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

        if (!apiKey) return json(500, { error: "OPENAI_API_KEY is not set in .env — add it and restart the dev server" });

        try {
          const { prompt, maxTokens = 800 } = JSON.parse(body);
          const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              max_tokens: maxTokens,
              temperature: 0.4,
            }),
          });

          if (!apiRes.ok) {
            const err = await apiRes.json().catch(() => ({}));
            const s = apiRes.status;
            const msg = s === 400 ? "Invalid request to OpenAI"
                      : s === 401 ? "OpenAI API key is invalid or unauthorized"
                      : s === 429 ? "OpenAI rate limit exceeded — wait a moment and retry"
                      : `OpenAI API error (${s})`;
            return json(s, { error: msg, detail: err });
          }

          const data = await apiRes.json();
          const text = data.choices?.[0]?.message?.content ?? null;
          return json(200, { text });
        } catch (e) {
          console.error("[homeblend-openai-proxy]", e);
          return json(502, { error: "Failed to connect to OpenAI API — check your network" });
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
    openaiProxyPlugin(),
  ],
  define: {
    "process.env": {},
  },
  resolve: {
    extensions: [".jsx", ".js", ".ts", ".tsx"],
  },
});
