import type { NextConfig } from "next";

export default {
  devIndicators: false,
  agentRules: false,
  experimental: { useTypeScriptCli: false },
} satisfies NextConfig;
