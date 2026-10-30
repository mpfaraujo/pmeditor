import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Arquivos *.dev.tsx / *.dev.ts (ex.: /dev/revisar) só viram rota em `next dev`.
// No build de produção a extensão não é reconhecida e a rota não existe.
const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  pageExtensions: isDev ? ["dev.tsx", "dev.ts", "tsx", "ts", "jsx", "js"] : ["tsx", "ts", "jsx", "js"],
  turbopack: {
    root: __dirname,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-popover", "@radix-ui/react-dialog", "@radix-ui/react-select", "@radix-ui/react-tabs", "@radix-ui/react-tooltip", "@radix-ui/react-dropdown-menu"],
  },
};

export default withSentryConfig(nextConfig, {
  org: "provamarela",
  project: "editor",
  silent: !process.env.CI,
  telemetry: false,
});
