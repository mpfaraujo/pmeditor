"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LogOut, User, LogIn } from "lucide-react";

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

// Componente separado: monta quando o popover abre → useEffect roda com o div já no DOM
function GoogleSignInButton({
  onCredential,
}: {
  onCredential: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !GOOGLE_CLIENT_ID) return;

    const render = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp: any) => {
          if (resp?.credential) onCredential(resp.credential);
        },
      });
      ref.current.innerHTML = "";
      window.google.accounts.id.renderButton(ref.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        locale: "pt-BR",
        width: 240,
      });
    };

    if (window.google) {
      render();
    } else {
      const timer = setTimeout(render, 200);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={ref} className="flex justify-center min-h-[44px]" />;
}

export function LoginButton() {
  const { user, isLoggedIn, loading, login, logout } = useAuth();
  const [gsiReady, setGsiReady] = useState(false);
  const [open, setOpen] = useState(false);

  const handleCredential = async (token: string) => {
    try {
      await login(token);
      setOpen(false);
    } catch (e) {
      console.error("Erro no login:", e);
    }
  };

  if (loading) {
    return <div className="h-9 w-24 animate-pulse rounded-md bg-slate-200" />;
  }

  // Logado: avatar + link para minha área + botão de sair
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

  // Não logado: botão "Entrar" sempre visível → popover com botão Google
  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setGsiReady(true)}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="gap-2 bg-white text-slate-800 border-slate-300 hover:bg-slate-50 font-semibold shadow-sm"
          >
            <LogIn className="h-4 w-4" />
            Entrar
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-5 border border-slate-200 shadow-xl rounded-xl"
          align="end"
        >
          <p className="text-sm font-semibold text-slate-800 mb-1">
            Bem-vindo ao ProvaMarela
          </p>
          <p className="text-xs text-slate-500 mb-4">
            Entre com sua conta Google para salvar questões e provas.
          </p>
          {/* Só monta o componente (e dispara o renderButton) quando o popover está aberto */}
          {open && gsiReady && (
            <GoogleSignInButton onCredential={handleCredential} />
          )}
          {open && !gsiReady && (
            <div className="h-10 w-60 animate-pulse rounded-md bg-slate-200" />
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}
