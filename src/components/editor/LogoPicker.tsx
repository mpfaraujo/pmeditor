"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, Check } from "lucide-react";

const UPLOAD_API = "https://mpfaraujo.com.br/guardafiguras/api/upload.php";
const LOGOS_API = "https://mpfaraujo.com.br/guardafiguras/api/logos.php";
const TOKEN = "uso_exclusivo_para_o_editor_de_textos_proseMirror_editor_de_questoes";

interface LogoEntry {
  url: string;
  instituicao: string | null;
}

interface LogoPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogoSelect: (url: string) => void;
  instituicao?: string;
}

export function LogoPicker({
  open,
  onOpenChange,
  onLogoSelect,
  instituicao,
}: LogoPickerProps) {
  const [logos, setLogos] = useState<LogoEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const fetchLogos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(LOGOS_API, {
        headers: { "X-Upload-Token": TOKEN },
      });
      const data = await res.json();
      if (data.success) setLogos(data.logos ?? []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchLogos();
      setFile(null);
      setError("");
    }
  }, [open, fetchLogos]);

  const handleSelect = (url: string) => {
    onLogoSelect(url);
    onOpenChange(false);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("type", "logo");
      if (instituicao && instituicao.trim()) {
        formData.append("instituicao", instituicao.trim());
      }

      const res = await fetch(UPLOAD_API, {
        method: "POST",
        headers: { "X-Upload-Token": TOKEN },
        body: formData,
      });
      const data = await res.json();

      if (data.success && data.url) {
        onLogoSelect(data.url);
        onOpenChange(false);
      } else {
        setError(data.error || "Erro ao fazer upload");
      }
    } catch {
      setError("Erro de conexão com o servidor");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Escolher Logo</DialogTitle>
          <DialogDescription>
            Selecione um logo da galeria ou envie um novo
          </DialogDescription>
        </DialogHeader>

        {/* Galeria */}
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logos.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Logos disponíveis</p>
            <div className="grid grid-cols-3 gap-3">
              {logos.map((logo) => (
                <button
                  key={logo.url}
                  type="button"
                  onClick={() => handleSelect(logo.url)}
                  className="group flex flex-col items-center gap-1 rounded-lg border p-2 hover:border-primary hover:bg-accent transition-colors cursor-pointer"
                >
                  <div className="relative h-16 w-full flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logo.url}
                      alt={logo.instituicao || "Logo"}
                      className="max-h-16 max-w-full object-contain"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded">
                      <Check className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  {logo.instituicao && (
                    <span className="text-xs text-muted-foreground text-center line-clamp-2 leading-tight">
                      {logo.instituicao}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum logo cadastrado ainda
          </p>
        )}

        {/* Separador */}
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              ou envie um novo
            </span>
          </div>
        </div>

        {/* Upload */}
        <div className="space-y-3">
          <Input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError("");
            }}
            disabled={uploading}
          />

          {file && (
            <p className="text-sm text-muted-foreground">
              {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Enviar e usar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
