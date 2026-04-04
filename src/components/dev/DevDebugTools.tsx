"use client";

import { useEffect } from "react";
import { Bug, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type Props = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  storageKey: string;
  snapshotKey: string;
  filePrefix: string;
  title?: string;
};

export default function DevDebugTools({
  enabled,
  onEnabledChange,
  storageKey,
  snapshotKey,
  filePrefix,
  title = "debug",
}: Props) {
  const { toast } = useToast();

  useEffect(() => {
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") return;
    try {
      onEnabledChange(window.localStorage?.getItem(storageKey) === "1");
    } catch {
      onEnabledChange(false);
    }
  }, [onEnabledChange, storageKey]);

  if (process.env.NODE_ENV === "production") return null;

  const getSnapshot = () => {
    if (typeof window === "undefined") return null;
    return (window as any)[snapshotKey] ?? null;
  };

  const handleToggle = () => {
    if (typeof window === "undefined") return;
    const next = !enabled;
    try {
      window.localStorage?.setItem(storageKey, next ? "1" : "0");
    } catch {}
    if (!next) {
      delete (window as any)[snapshotKey];
    }
    onEnabledChange(next);
    toast({
      title: next ? `${title} ligado` : `${title} desligado`,
      description: next
        ? "Agora você pode copiar ou baixar o snapshot do estado atual."
        : "O snapshot automático foi desativado.",
    });
  };

  const handleCopy = async () => {
    const payload = getSnapshot();
    if (!payload) {
      toast({
        title: "Debug indisponível",
        description: "Repagine a tela e tente novamente.",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast({
        title: "Debug copiado",
        description: "O snapshot completo foi copiado.",
      });
    } catch {
      toast({
        title: "Falha ao copiar",
        description: "Não foi possível copiar o debug.",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    const payload = getSnapshot();
    if (!payload || typeof window === "undefined") {
      toast({
        title: "Debug indisponível",
        description: "Repagine a tela e tente novamente.",
        variant: "destructive",
      });
      return;
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filePrefix}-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast({
      title: "Debug baixado",
      description: "O snapshot completo foi salvo em JSON.",
    });
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={handleToggle}
        className={enabled
          ? "bg-amber-100 hover:bg-amber-200 border-amber-400 text-amber-900"
          : "bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800"}
        title={`Ligar ou desligar ${title}`}
      >
        <Bug className="h-4 w-4 mr-2" />
        {enabled ? "Debug ON" : "Debug OFF"}
      </Button>

      {enabled && (
        <>
          <Button
            variant="outline"
            onClick={handleCopy}
            className="bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800"
            title="Copiar snapshot completo"
          >
            <Bug className="h-4 w-4 mr-2" />
            Copiar Debug
          </Button>

          <Button
            variant="outline"
            onClick={handleDownload}
            className="bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800"
            title="Baixar snapshot completo"
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar Debug
          </Button>
        </>
      )}
    </>
  );
}
