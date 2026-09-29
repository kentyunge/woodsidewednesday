"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Run an admin API call with a busy flag, a toast, and a refresh of server data. */
export function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run<T>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> {
    setBusy(true);
    try {
      const r = await fn();
      if (ok) toast.success(ok);
      router.refresh();
      return r;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}
