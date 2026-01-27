import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          Editor de Questões - ProseMirror
        </h1>
        <p className="text-gray-600 mb-8">
          Sistema de edição de questões.
        </p>
        <div className="space-x-4">
 <Link href="/editor">
          <Button size="lg">Novo Editor</Button>
        </Link>

        <Link href="/editor/questoes">
          <Button size="lg">Montar Prova</Button>
        </Link>

        </div>
       
      </div>
    </div>
  );
}