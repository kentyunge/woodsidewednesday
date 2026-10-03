"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

const EVERY_MS = 20_000;

/**
 * While a week is live, re-fetch the page's server data every 20 seconds so new scores and
 * points show up without a reload. Pauses while the tab is in the background and catches up
 * as soon as it's visible again.
 */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, EVERY_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  return (
    <Badge className="gap-1.5" title="Scores update automatically">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
        <span className="relative inline-flex size-2 rounded-full bg-white" />
      </span>
      Live
    </Badge>
  );
}
