import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
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
