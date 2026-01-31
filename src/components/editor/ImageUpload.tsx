"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Upload } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UPLOAD_API = "https://mpfaraujo.com.br/guardafiguras/api/upload.php";
const UPLOAD_TOKEN = "uso_exclusivo_para_o_editor_de_textos_proseMirror_editor_de_questoes";

interface ImageUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageInsert: (url: string, widthCm: number) => void;
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function ImageUpload({ open, onOpenChange, onImageInsert }: ImageUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>("");
  const [size, setSize] = useState<string>("4"); // padrão 4cm

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError("");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Selecione uma imagem");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch(UPLOAD_API, {
        method: "POST",
        headers: {
          "X-Upload-Token": UPLOAD_TOKEN,
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.url) {
        const widthCm = clampInt(parseInt(size, 10), 1, 8);
        onImageInsert(data.url, widthCm);
        onOpenChange(false);
        setFile(null);
      } else {
        setError(data.error || "Erro ao fazer upload");
      }
    } catch (err) {
      setError("Erro de conexão com o servidor");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inserir Imagem</DialogTitle>
          <DialogDescription>
            Selecione uma imagem para inserir na questão (máx. 5MB, mín. 472px)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            onChange={handleFileChange}
            disabled={uploading}
          />

          <div className="space-y-2">
            <label className="text-sm font-medium">Largura da imagem (cm)</label>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tamanho" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 cm</SelectItem>
                <SelectItem value="2">2 cm</SelectItem>
                <SelectItem value="3">3 cm</SelectItem>
                <SelectItem value="4">4 cm</SelectItem>
                <SelectItem value="5">5 cm</SelectItem>
                <SelectItem value="6">6 cm</SelectItem>
                <SelectItem value="7">7 cm</SelectItem>
                <SelectItem value="8">8 cm</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {file && (
            <p className="text-sm text-gray-600">
              Arquivo selecionado: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setFile(null);
              setError("");
            }}
            disabled={uploading}
          >
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Inserir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
