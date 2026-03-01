import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function describeOpenAIError(status) {
  if (status === 400) return "Invalid request to OpenAI API";
  if (status === 401) return "OpenAI API key is invalid — check OPENAI_API_KEY in .env.local";
  if (status === 403) return "OpenAI API key does not have access to this model";
  if (status === 429) return "OpenAI rate limit exceeded — wait a moment and retry";
  if (status === 500 || status === 503) return "OpenAI is temporarily unavailable — try again shortly";
  return `OpenAI API error (${status})`;
}

function openaiProxyPlugin() {
  let apiKey = "";

  return {
    name: "homeblend-openai-proxy",
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), "");
      apiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || "";
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== "/api/openai") return next();
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

        if (!apiKey) return json(500, { error: "OPENAI_API_KEY is not set in .env.local — add it and restart the dev server" });

        try {
          const { prompt, maxTokens = 800 } = JSON.parse(body);
          const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
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
            const msg = describeOpenAIError(apiRes.status);
            return json(apiRes.status, { error: msg, detail: err });
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
