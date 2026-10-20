import { InstallPrompt } from "@/components/layout/install-prompt";
import { BottomTabs, Nav } from "@/components/layout/nav";
import { requirePageActor } from "@/server/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const actor = await requirePageActor();
  return (
    // A fixed-height shell: the page scrolls inside <main> and the tab bar is a normal flex item at the
    // bottom, so it stays anchored in iOS home-screen mode (where position: fixed gets stranded).
    <div className="flex h-dvh flex-col">
      <Nav name={actor.name} isAdmin={actor.isAdmin} hasGolfer={actor.golferId !== null} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <main className="mx-auto w-full max-w-6xl px-3 pt-4 pb-6 sm:px-4 sm:pt-6">
          <InstallPrompt />
          {children}
        </main>
      </div>
      <BottomTabs isAdmin={actor.isAdmin} hasGolfer={actor.golferId !== null} />
    </div>
  );
}
