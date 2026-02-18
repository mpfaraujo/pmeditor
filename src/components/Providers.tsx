"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { ProvaProvider } from "@/contexts/ProvaContext";
import { Toaster } from "@/components/ui/toaster";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProvaProvider>
        {children}
        <Toaster />
      </ProvaProvider>
    </AuthProvider>
  );
}
