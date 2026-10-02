"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Flag, LayoutDashboard, LogOut, Settings, Shield, User, UserCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

interface NavProps {
  name: string;
  isAdmin: boolean;
  hasGolfer: boolean;
}

function useLinks({ isAdmin, hasGolfer }: Pick<NavProps, "isAdmin" | "hasGolfer">) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "League", icon: LayoutDashboard },
    ...(hasGolfer ? [{ href: "/me", label: "My Stats", icon: User }] : []),
    { href: "/schedule", label: "Schedule", icon: CalendarDays },
    { href: "/golfers", label: "Golfers", icon: Users },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return { links, active, pathname };
}

/** Full-screen flows (hole-by-hole scoring) hide the tab bar and install banner to fit one hole on screen. */
export const isFocusedScreen = (pathname: string) => /^\/matches\/\d+\/play$/.test(pathname);

export function useSignOut() {
  const router = useRouter();
  return async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };
}

/** Top bar. On phones it's just the title and a profile button; the sections live in the bottom tab bar. */
export function Nav({ name, isAdmin, hasGolfer }: NavProps) {
  const { links, active, pathname } = useLinks({ isAdmin, hasGolfer });
  const signOut = useSignOut();

  return (
    <header className="bg-primary text-primary-foreground sticky top-0 z-40 pt-[env(safe-area-inset-top)] shadow-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Flag className="size-5" />
          <span>Woodside Wednesday</span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/15",
                active(l.href) && "bg-white/20",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-1 md:flex">
          <Link href="/profile" className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-white/15">
            <Settings className="size-4" />
            {name}
          </Link>
          <Button variant="ghost" size="icon-sm" className="hover:bg-white/15 hover:text-primary-foreground" onClick={signOut} title="Sign out">
            <LogOut />
          </Button>
        </div>
        <Link
          href="/profile"
          className={cn("-mr-2 ml-auto rounded-full p-2 hover:bg-white/15 md:hidden", pathname.startsWith("/profile") && "bg-white/20")}
        >
          <UserCircle className="size-6" />
          <span className="sr-only">Profile</span>
        </Link>
      </div>
    </header>
  );
}

/** App-style tab bar pinned to the bottom of the screen on phones. */
export function BottomTabs({ isAdmin, hasGolfer }: Pick<NavProps, "isAdmin" | "hasGolfer">) {
  const { links, active, pathname } = useLinks({ isAdmin, hasGolfer });
  if (isFocusedScreen(pathname)) return null;
  return (
    <nav
      aria-label="Sections"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="flex">
        {links.map((l) => {
          const on = active(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium [-webkit-tap-highlight-color:transparent]",
                on ? "text-primary" : "text-muted-foreground",
              )}
            >
              <l.icon className={cn("size-5", on && "stroke-[2.5]")} />
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
