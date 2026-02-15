"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

export function TurmasTab() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Users className="mx-auto h-12 w-12 text-slate-300" />
        <h3 className="mt-4 text-lg font-medium text-slate-500">
          Nenhuma turma cadastrada
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          Organize seus alunos por turma e período.
        </p>
        <Button disabled className="mt-6" title="Em breve">
          Nova Turma
        </Button>
      </CardContent>
    </Card>
  );
}
