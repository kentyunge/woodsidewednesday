"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SeasonTabs({ seasonId }: { seasonId: number }) {
  const pathname = usePathname();
  const base = `/admin/seasons/${seasonId}`;
  const tabs = [
    { href: base, label: "Details" },
    { href: `${base}/players`, label: "Players" },
    { href: `${base}/schedule`, label: "Schedule" },
  ];
  return (
    <nav className="flex gap-4 border-b">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition-colors",
            pathname === t.href ? "border-primary text-foreground" : "text-muted-foreground hover:text-foreground border-transparent",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
