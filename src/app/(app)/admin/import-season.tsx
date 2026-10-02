"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import type { SeasonImportResult } from "@/server/season-import";

/** Load a finished season from a JSON file: check it first (dry run), then import on confirm. */
export function ImportSeasonButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payload, setPayload] = useState<unknown>(null);
  const [preview, setPreview] = useState<SeasonImportResult | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const reset = () => {
    setPayload(null);
    setPreview(null);
    setProblems([]);
  };

  async function check(file: File) {
    reset();
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      setProblems(["That file isn't valid JSON."]);
      return;
    }
    setBusy(true);
    try {
      setPreview(await api<SeasonImportResult>("/seasons/import?dryRun=true", { body: data }));
      setPayload(data);
    } catch (e) {
      setProblems((e instanceof Error ? e.message : "Check failed").split("; "));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      const r = await api<SeasonImportResult>("/seasons/import", { body: payload });
      toast.success(`${r.seasonName} imported`);
      setOpen(false);
      reset();
      router.push(`/admin/seasons/${r.seasonId}/schedule`);
      router.refresh();
    } catch (e) {
      setProblems((e instanceof Error ? e.message : "Import failed").split("; "));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import a season</DialogTitle>
          <DialogDescription>
            Choose a season import file (.json). It&apos;s checked first; nothing is saved until you confirm.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="file"
          accept="application/json,.json"
          aria-label="Season import file"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) check(f);
          }}
        />
        {busy && !preview && <p className="text-muted-foreground text-sm">Checking…</p>}
        {problems.length > 0 && (
          <div role="alert" className="border-destructive/40 bg-destructive/5 rounded-md border p-3 text-sm">
            <p className="mb-1 font-medium">The file can&apos;t be imported:</p>
            <ul className="list-disc space-y-0.5 pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {preview && (
          <div className="bg-muted/50 space-y-1 rounded-md p-3 text-sm">
            <p className="font-medium">{preview.seasonName}</p>
            <p>
              {preview.players.length} players: {preview.players.join(", ")}
            </p>
            <p>
              {preview.previousRounds} earlier rounds for handicaps · {preview.weeks} weeks · {preview.matches} matches ·{" "}
              {preview.cards} scorecards
            </p>
            {preview.newSubs.length > 0 && <p>New subs: {preview.newSubs.join(", ")}</p>}
            {preview.existingSubs.length > 0 && <p>Existing subs: {preview.existingSubs.join(", ")}</p>}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={busy || !preview} onClick={confirm}>
            {busy && preview ? "Importing…" : "Import season"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
