import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
};

export default withSentryConfig(nextConfig, {
  org: "provamarela",
  project: "editor",
  silent: !process.env.CI,
  telemetry: false,
});
