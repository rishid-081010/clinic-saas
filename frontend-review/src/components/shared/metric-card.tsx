import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { cn } from "../../lib/utils";

const toneStyles = {
  teal: "bg-cyan-50 text-cyan-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  coral: "bg-rose-50 text-rose-700",
};

type MetricCardProps = {
  label: string;
  value: string;
  delta: string;
  tone: keyof typeof toneStyles;
};

export function MetricCard({ label, value, delta, tone }: MetricCardProps) {
  const isDown = delta.startsWith("-");
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-normal">{value}</p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold",
              toneStyles[tone],
            )}
          >
            {isDown ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
            {delta}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
