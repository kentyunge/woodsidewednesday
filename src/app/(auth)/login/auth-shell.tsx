import { Flag } from "lucide-react";

/** Logo, title and centered card area shared by the sign-in pages. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-primary/15 to-background p-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="bg-primary text-primary-foreground rounded-full p-3">
            <Flag className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Woodside Wednesday</h1>
          <p className="text-muted-foreground text-sm">Golf league scores, standings & stats</p>
        </div>
        {children}
      </div>
    </main>
  );
}
