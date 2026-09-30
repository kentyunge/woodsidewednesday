"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Seasons", match: (p: string) => p === "/admin" || p.startsWith("/admin/seasons") },
  { href: "/admin/golfers", label: "Golfers", match: (p: string) => p.startsWith("/admin/golfers") },
  { href: "/admin/subs", label: "Subs", match: (p: string) => p.startsWith("/admin/subs") },
  { href: "/admin/handicaps", label: "Handicaps", match: (p: string) => p.startsWith("/admin/handicaps") },
  { href: "/admin/recaps", label: "Recaps", match: (p: string) => p.startsWith("/admin/recaps") },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="bg-muted inline-flex max-w-full overflow-x-auto rounded-lg p-1">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium",
            t.match(pathname) ? "bg-background shadow-sm" : "text-muted-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
