"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BookOpen, FileInput, Users, Wrench } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import "./admin-workspace.css";

type AdminSection = "usuarios" | "gerenciar" | "importar" | "fixes";

const sections = [
  { id: "gerenciar", label: "Questões", icon: BookOpen },
  { id: "fixes", label: "Revisão pós-importação", icon: Wrench },
  { id: "importar", label: "Importação", icon: FileInput },
  { id: "usuarios", label: "Usuários", icon: Users },
] as const;

export function AdminWorkspace({ current, children }: { current: AdminSection; children: ReactNode }) {
  const title = sections.find(section => section.id === current)?.label ?? "Administração";
  return (
    <WorkspaceShell section="area" title={`Administração / ${title}`} className="admin-workspace">
      <nav className="admin-section-nav print:hidden" aria-label="Administração">
        {sections.map(({ id, label, icon: Icon }) => (
          <Link key={id} href={`/admin/${id}`} aria-current={current === id ? "page" : undefined}>
            <Icon aria-hidden="true" size={16} strokeWidth={1.7} />{label}
          </Link>
        ))}
      </nav>
      {children}
    </WorkspaceShell>
  );
}
