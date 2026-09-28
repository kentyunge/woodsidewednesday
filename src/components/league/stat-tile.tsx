import { cn } from "@/lib/utils";

export function StatTile({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card rounded-xl border p-3 sm:p-4", className)}>
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">{value}</div>
      {sub && <div className="text-muted-foreground mt-0.5 truncate text-xs">{sub}</div>}
    </div>
  );
}
