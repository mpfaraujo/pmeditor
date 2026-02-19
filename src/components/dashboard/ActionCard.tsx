import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

export function ActionCard(props: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: "blue" | "green" | "purple" | "gray";
  badge?: string;
}) {
  const accent =
    props.accent === "blue"
      ? "hover:border-blue-300"
      : props.accent === "green"
      ? "hover:border-emerald-300"
      : props.accent === "purple"
      ? "hover:border-purple-300"
      : "hover:border-slate-300";

  const iconBg =
    props.accent === "blue"
      ? "bg-gradient-to-br from-blue-500 to-cyan-500 text-white"
      : props.accent === "green"
      ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white"
      : props.accent === "purple"
      ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white"
      : "bg-gradient-to-br from-slate-500 to-gray-500 text-white";

  return (
    <Link href={props.href} className={`group block stripe-card hover-lift ${accent}`}>
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className={`h-12 w-12 rounded-xl ${iconBg} flex items-center justify-center`}>
            {props.icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">{props.title}</h2>
              {props.badge ? <Badge variant="secondary">{props.badge}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{props.description}</p>

            <div className="mt-4 inline-flex items-center text-sm font-medium">
              Acessar
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
