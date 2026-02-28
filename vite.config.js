import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      include: ["**/*.jsx", "**/*.js"],
    }),
  ],
  define: {
    "process.env": {},
  },
  resolve: {
    extensions: [".jsx", ".js", ".ts", ".tsx"],
  },
});
