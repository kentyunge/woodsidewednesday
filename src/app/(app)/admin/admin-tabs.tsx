"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Seasons" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/golfers", label: "Golfers" },
  { href: "/admin/handicaps", label: "Handicaps" },
];

export function AdminTabs() {
  const pathname = usePathname();
  const season = useSearchParams().get("season");
  return (
    <nav className="bg-muted inline-flex rounded-lg p-1">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={season ? `${t.href}?season=${season}` : t.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium",
            pathname === t.href ? "bg-background shadow-sm" : "text-muted-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
