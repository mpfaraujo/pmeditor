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
      ? "group-hover:border-blue-200 group-hover:bg-blue-50/40"
      : props.accent === "green"
      ? "group-hover:border-emerald-200 group-hover:bg-emerald-50/40"
      : props.accent === "purple"
      ? "group-hover:border-violet-200 group-hover:bg-violet-50/40"
      : "group-hover:border-slate-200 group-hover:bg-slate-50/40";

  const iconBg =
    props.accent === "blue"
      ? "bg-blue-100 text-blue-700"
      : props.accent === "green"
      ? "bg-emerald-100 text-emerald-700"
      : props.accent === "purple"
      ? "bg-violet-100 text-violet-700"
      : "bg-slate-100 text-slate-700";

  return (
    <Link href={props.href} className={`group block rounded-xl border bg-white shadow-sm transition-all hover:shadow-md ${accent}`}>
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
