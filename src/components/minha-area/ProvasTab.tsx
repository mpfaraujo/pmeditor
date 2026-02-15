"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, BookOpen } from "lucide-react";

export function ProvasTab() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <ClipboardList className="mx-auto h-12 w-12 text-slate-300" />
        <h3 className="mt-4 text-lg font-medium text-slate-500">
          Nenhuma prova salva
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          Suas provas montadas aparecerão aqui.
        </p>
        <Button asChild className="mt-6">
          <Link href="/editor/questoes/filtro">
            <BookOpen className="h-4 w-4 mr-2" />
            Montar Prova
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
