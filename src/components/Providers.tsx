"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { ProvaProvider } from "@/contexts/ProvaContext";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProvaProvider>{children}</ProvaProvider>
    </AuthProvider>
  );
}
