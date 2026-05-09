import { defineConfig } from "vite";

export default defineConfig({
  // Serve static assets (site-data.json) from the generated output folder
  publicDir: "../docs-site-v2",
});
