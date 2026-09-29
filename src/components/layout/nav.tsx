"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Flag, LayoutDashboard, LogOut, Menu, Settings, Shield, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

interface NavProps {
  name: string;
  isAdmin: boolean;
  hasGolfer: boolean;
}

export function Nav({ name, isAdmin, hasGolfer }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const links = [
    { href: "/", label: "League", icon: LayoutDashboard },
    ...(hasGolfer ? [{ href: "/me", label: "My Stats", icon: User }] : []),
    { href: "/schedule", label: "Schedule", icon: CalendarDays },
    { href: "/golfers", label: "Golfers", icon: Users },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-primary text-primary-foreground sticky top-0 z-40 shadow-sm">
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
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-auto hover:bg-white/15 hover:text-primary-foreground md:hidden">
              <Menu />
              <span className="sr-only">Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64">
            <SheetHeader>
              <SheetTitle>{name}</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-2">
              {[...links, { href: "/profile", label: "Profile", icon: Settings }].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent",
                    active(l.href) && "bg-accent",
                  )}
                >
                  <l.icon className="size-4" />
                  {l.label}
                </Link>
              ))}
              <button
                onClick={signOut}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium hover:bg-accent"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
