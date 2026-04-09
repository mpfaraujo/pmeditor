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
  const iconBg =
    props.accent === "blue"
      ? "bg-[#0F172A] text-[#FBC02D]"
      : props.accent === "green"
      ? "bg-[#10261F] text-[#FBC02D]"
      : props.accent === "purple"
      ? "bg-[#17142B] text-[#FBC02D]"
      : "bg-[#1B1F2D] text-[#FBC02D]";

  return (
    <Link
      href={props.href}
      className="group block rounded-2xl border border-white/8 bg-[#10172B] shadow-[0_18px_40px_rgba(0,0,0,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FBC02D]/45 hover:bg-[#121B31] hover:shadow-[0_22px_46px_rgba(0,0,0,0.3)]"
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className={`h-12 w-12 rounded-2xl ${iconBg} flex items-center justify-center shadow-sm`}>
            {props.icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-white">{props.title}</h2>
              {props.badge ? <Badge variant="secondary" className="border-white/10 bg-white/8 text-[#d8e2f0]">{props.badge}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-[#9eb4d1]">{props.description}</p>

            <div className="mt-4 inline-flex items-center text-sm font-medium text-[#F4F4F2]">
              Acessar
              <ArrowRight className="ml-2 h-4 w-4 text-[#FBC02D] transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
