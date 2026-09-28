import path from "path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
        "server-only": path.resolve(__dirname, "./lib/server-only-test-stub.ts"),
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  esbuild: {
    // SÃ³ para o test runner: tsconfig.json usa "jsx":"preserve" de propÃ³sito
    // (o Next.js faz a transformaÃ§Ã£o real via SWC no build). NecessÃ¡rio para
    // renderizar componentes de verdade em teste (PedidosTable.render.test.ts).
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});


