import { Card, CardContent } from "@/components/ui/card";
import { LayoutDashboard } from "lucide-react";

export function StatCard(props: {
  label: string;
  value: string | number;
  tone: "blue" | "green" | "purple";
}) {
  const tone = props.tone;

  const toneClasses =
    tone === "blue"
      ? "text-blue-600 bg-blue-50 border-blue-100"
      : tone === "green"
      ? "text-emerald-600 bg-emerald-50 border-emerald-100"
      : "text-violet-600 bg-violet-50 border-violet-100";

  const valueClass =
    tone === "blue"
      ? "text-blue-700"
      : tone === "green"
      ? "text-emerald-700"
      : "text-violet-700";

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className={`inline-flex items-center rounded-md border px-2 py-1 text-xs ${toneClasses}`}>
              <LayoutDashboard className="mr-1 h-3.5 w-3.5" />
              Métrica
            </div>
            <div className="mt-3 text-4xl font-semibold tracking-tight">
              <span className={valueClass}>{props.value}</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{props.label}</div>
          </div>

          <div className={`h-12 w-12 rounded-xl border ${toneClasses} flex items-center justify-center`} aria-hidden>
            <LayoutDashboard className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
