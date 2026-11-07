"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, FilePlus2, FolderOpen, LayoutDashboard, PanelsTopLeft } from "lucide-react";
import { LoginButton } from "@/components/auth/LoginButton";
import "./workspace.css";

type WorkspaceSection = "dashboard" | "bank" | "editor" | "mount" | "area";

const destinations = [
  { id: "dashboard", href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { id: "bank", href: "/editor/questoes", label: "Banco", icon: BookOpen },
  { id: "editor", href: "/editor?skipYaml=1", label: "Editor", icon: FilePlus2 },
  { id: "mount", href: "/editor/prova/montar", label: "Montar", icon: PanelsTopLeft },
  { id: "area", href: "/minha-area", label: "Minha área", icon: FolderOpen },
] as const;

export function WorkspaceShell({
  section, title, children, className = "",
}: {
  section: WorkspaceSection;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`workspace ${className}`}>
      <nav className="workspace-nav print:hidden" aria-label="Navegação principal">
        <Link href="/dashboard" className="workspace-monogram" aria-label="ProvaMarela — início">PM</Link>
        <div className="workspace-destinations">
          {destinations.map(({ id, href, label, icon: Icon }) => (
            <Link key={id} href={href} aria-current={section === id ? "page" : undefined}>
              <Icon aria-hidden="true" size={19} strokeWidth={1.7} />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>
      <div className="workspace-body">
        <header className="workspace-header print:hidden">
          <Link href="/dashboard" className="workspace-wordmark">Prova<span>Marela</span></Link>
          <span className="workspace-location">{title}</span>
          <div className="workspace-account"><LoginButton /></div>
        </header>
        {children}
      </div>
    </div>
  );
}
