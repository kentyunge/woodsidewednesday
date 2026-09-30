"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, Lock, Mail, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { useAction } from "../../../use-action";

export interface RecapSummary {
  id: number;
  subject: string;
  sentTo: string[];
  createdAt: string;
}

interface Props {
  week: { id: number; number: number; closed: boolean; incomplete: number; scored: boolean };
  recaps: RecapSummary[];
  /** Who a sent recap goes to right now. */
  recipients: string;
}

export function WeekCloseControls({ week, recaps, recipients }: Props) {
  const { busy, run } = useAction();
  const [open, setOpen] = useState(false);
  const [sendRecap, setSendRecap] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  async function complete() {
    setWorking(sendRecap ? "Closing the week and writing the recap… this can take a minute." : "Closing the week…");
    const r = await run(() =>
      api<{ recapError: string | null; recap: { sentTo: string[] } | null }>(`/weeks/${week.id}/complete`, { body: { sendRecap } }),
    );
    setWorking(null);
    if (!r) return;
    setOpen(false);
    if (r.recapError) toast.warning(`Week ${week.number} closed, but the recap failed: ${r.recapError}`, { duration: 10000 });
    else if (r.recap) toast.success(`Week ${week.number} closed. Recap sent to ${r.recap.sentTo.join(", ")}.`);
    else toast.success(`Week ${week.number} closed.`);
  }

  async function recap(send: boolean) {
    const t = toast.loading(send ? "Writing and sending the recap…" : "Writing a preview recap…");
    const r = await run(() => api<{ id: number; sentTo: string[] }>(`/weeks/${week.id}/recap`, { body: { send } }));
    toast.dismiss(t);
    if (r) toast.success(send ? `Recap sent to ${r.sentTo.join(", ")}.` : "Preview ready.", {
      action: { label: "View", onClick: () => window.open(`/admin/recaps/${r.id}`, "_self") },
    });
  }

  return (
    <div className="bg-muted/40 space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        {week.closed ? (
          <>
            <Badge>
              <Lock /> Complete
            </Badge>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => recap(false)}>
              <Eye /> Preview recap
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => recap(true)}>
              <Mail /> Send recap again
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (confirm(`Reopen week ${week.number}? Golfers will be able to edit its scores again.`))
                  run(() => api(`/weeks/${week.id}/reopen`, { body: {} }), `Week ${week.number} reopened`);
              }}
            >
              <RotateCcw /> Reopen
            </Button>
          </>
        ) : (
          <Button size="sm" disabled={busy || !week.scored} onClick={() => setOpen(true)} title={week.scored ? undefined : "No scores entered yet"}>
            <CheckCircle2 /> Mark complete
          </Button>
        )}
      </div>
      {recaps.length > 0 && (
        <ul className="text-muted-foreground space-y-0.5 text-xs">
          {recaps.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/recaps/${r.id}`} className="hover:text-foreground hover:underline">
                {r.subject}
              </Link>{" "}
              · {r.sentTo.length ? `sent to ${r.sentTo.length}` : "preview"}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={(o) => !working && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark week {week.number} complete?</DialogTitle>
            <DialogDescription>Golfers won&apos;t be able to change this week&apos;s scores. You still can, and you can reopen it.</DialogDescription>
          </DialogHeader>
          {week.incomplete > 0 && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
              {week.incomplete} match{week.incomplete === 1 ? " is" : "es are"} missing scores.
            </p>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="accent-primary mt-0.5 size-4" checked={sendRecap} onChange={(e) => setSendRecap(e.target.checked)} />
            <span>
              Email the Claude-written recap
              <span className="text-muted-foreground block text-xs">Goes to: {recipients}</span>
            </span>
          </label>
          {working && <p className="text-muted-foreground text-sm">{working}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={!!working} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={complete}>
              Mark complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
