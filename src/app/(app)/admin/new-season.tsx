"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import type { Season } from "@/server/league";
import { SeasonFields, fromForm, toForm } from "./season-form";
import { useAction } from "./use-action";

export function NewSeasonButton() {
  const router = useRouter();
  const { busy, run } = useAction();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(toForm(null));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New season
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const s = await run(() => api<Season>("/seasons", { body: fromForm(form) }), "Season created");
            if (s) {
              setOpen(false);
              setForm(toForm(null));
              router.push(`/admin/seasons/${s.id}/players`);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>New season</DialogTitle>
            <DialogDescription>Next you&apos;ll pick its players, then generate the schedule.</DialogDescription>
          </DialogHeader>
          <SeasonFields form={form} set={setForm} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Create season
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
