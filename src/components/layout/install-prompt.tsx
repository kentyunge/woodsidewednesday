"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Flag, Share, SquarePlus, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isFocusedScreen } from "./nav";

/** Chrome/Android's install event (not in the TS DOM types). */
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios" | "installable" | null;

const DISMISS_KEY = "install-prompt-dismissed";
const DISMISS_DAYS = 30;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support gives it away.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

const noop = () => () => {};
/** True once running in the browser (false while server rendering), without a set-state-in-effect. */
const useIsClient = () => useSyncExternalStore(noop, () => true, () => false);

/**
 * Whether the app can be added to the home screen here: "ios" (manual steps via the Share
 * menu), "installable" (the browser offers an install prompt), or null (already installed,
 * or not supported).
 */
export function useInstall() {
  const client = useIsClient();
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // show our own button instead of the browser's mini-bar
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  let platform: Platform = null;
  if (client && !installed && !isStandalone()) platform = isIos() ? "ios" : event ? "installable" : null;

  async function install() {
    if (!event) return;
    await event.prompt();
    if ((await event.userChoice).outcome === "accepted") setInstalled(true);
    setEvent(null);
  }

  return { platform, install };
}

/** The iPhone/iPad steps: Share → Add to Home Screen → open it from the home screen. */
export function IosInstallSteps() {
  return (
    <ol className="space-y-2 text-sm">
      <li className="flex items-start gap-2">
        <Step n={1} />
        <span>
          Tap <Share className="mx-0.5 inline size-4 align-text-bottom text-blue-600" aria-label="Share" /> <b>Share</b> in
          Safari&apos;s toolbar.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <Step n={2} />
        <span>
          Scroll down and tap <SquarePlus className="mx-0.5 inline size-4 align-text-bottom" aria-hidden /> <b>Add to Home Screen</b>
          , then <b>Add</b>.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <Step n={3} />
        <span>
          Open <b>Woodside</b> from your home screen. If it asks you to sign in, use the 6-digit code from the email (email
          links open in Safari, not the app).
        </span>
      </li>
    </ol>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="bg-primary text-primary-foreground mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
      {n}
    </span>
  );
}

/** Dismissible banner inviting golfers to add the app to their home screen. */
export function InstallPrompt() {
  const { platform, install } = useInstall();
  const dismissedBefore = useSyncExternalStore(noop, dismissedRecently, () => true);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (!platform || dismissedBefore || dismissed || isFocusedScreen(pathname)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // private mode: just hide it for this visit
    }
  };

  return (
    <div className="border-primary/30 bg-primary/5 mb-4 rounded-xl border p-3 sm:p-4" role="region" aria-label="Install the app">
      <div className="flex items-start gap-3">
        <div className="bg-primary text-primary-foreground rounded-lg p-2">
          <Flag className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Get the Woodside app</p>
          <p className="text-muted-foreground text-sm">Add it to your home screen for one-tap scores and standings.</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={dismiss} aria-label="Dismiss" className="-mt-1 -mr-1">
          <X />
        </Button>
      </div>
      {platform === "installable" ? (
        <Button size="sm" className="mt-3" onClick={install}>
          <Download /> Install
        </Button>
      ) : open ? (
        <div className="mt-3">
          <IosInstallSteps />
        </div>
      ) : (
        <Button size="sm" className="mt-3" onClick={() => setOpen(true)}>
          Show me how
        </Button>
      )}
    </div>
  );
}

/** Always-available version for the Profile page, in case the banner was dismissed. */
export function InstallCard() {
  const { platform, install } = useInstall();
  if (!platform) return null;
  return (
    <div className="bg-card space-y-3 rounded-xl border p-4 sm:p-6">
      <div>
        <p className="font-semibold">Add to your home screen</p>
        <p className="text-muted-foreground text-sm">Opens full screen like an app, one tap from your home screen.</p>
      </div>
      {platform === "installable" ? (
        <Button size="sm" onClick={install}>
          <Download /> Install
        </Button>
      ) : (
        <IosInstallSteps />
      )}
    </div>
  );
}
