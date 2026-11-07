import Link from "next/link";
import { ArrowRight, BookOpen, PanelsTopLeft, Settings2 } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import "@/app/support.css";

export default function Page() {
  return <WorkspaceShell section="mount" title="Preparar prova"><main className="support-page"><div className="support-page-inner"><header className="support-page-heading"><div><h1>Prepare sua prova</h1><p>Selecione questões, configure a apresentação e confira a montagem.</p></div></header><nav className="support-proof-gateway" aria-label="Etapas da prova">{[{href:"/editor/questoes",title:"Selecionar questões",description:"Consulte o banco e escolha o conteúdo da avaliação.",icon:BookOpen},{href:"/editor/prova/selecionar-layout",title:"Configurar apresentação",description:"Defina formato, colunas e dados do cabeçalho.",icon:Settings2},{href:"/editor/prova/montar",title:"Conferir montagem",description:"Revise as páginas e prepare a impressão.",icon:PanelsTopLeft}].map(({href,title,description,icon:Icon})=><Link key={href} href={href}><Icon size={24} aria-hidden="true"/><div><h2>{title}</h2><p>{description}</p></div><ArrowRight className="ml-auto shrink-0" size={18} aria-hidden="true"/></Link>)}</nav></div></main></WorkspaceShell>;
}
