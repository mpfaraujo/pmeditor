"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (el: HTMLElement, config: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export function LoginButton() {
  const { user, isLoggedIn, loading, login, logout } = useAuth();
  const btnRef = useRef<HTMLDivElement>(null);
  const [gsiReady, setGsiReady] = useState(false);

  const handleCredentialResponse = async (response: any) => {
    if (response?.credential) {
      try {
        await login(response.credential);
      } catch (e) {
        console.error("Erro no login:", e);
      }
    }
  };

  useEffect(() => {
    if (!gsiReady || isLoggedIn || !btnRef.current || !GOOGLE_CLIENT_ID) return;

    // Polling para garantir que window.google está disponível
    const checkGoogle = () => {
      if (!window.google || !btnRef.current) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });

      window.google.accounts.id.renderButton(btnRef.current, {
        theme: "outline",
        size: "medium",
        text: "signin_with",
        locale: "pt-BR",
      });
    };

    // Tentar imediatamente
    if (window.google) {
      checkGoogle();
    } else {
      // Tentar novamente após pequeno delay
      const timer = setTimeout(checkGoogle, 100);
      return () => clearTimeout(timer);
    }
  }, [gsiReady, isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="h-9 w-24 animate-pulse rounded-md bg-slate-200" />
    );
  }

  if (isLoggedIn && user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/minha-area"
          className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-100 transition-colors"
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="h-8 w-8 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <User className="h-4 w-4" />
            </div>
          )}
          <span className="hidden text-sm font-medium sm:inline">
            {user.nome || user.email}
          </span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          title="Sair"
          className="h-8 w-8"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setGsiReady(true)}
      />
      <div ref={btnRef} />
    </>
  );
}
