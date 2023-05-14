import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import remarkMath from "remark-math";
import rehypeMathjax from "rehype-mathjax";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    {
      enforce: "pre",
      ...mdx({
        remarkPlugins: [remarkMath],
        rehypePlugins: [rehypeMathjax],
      }),
    },
    react(),
  ],
});
