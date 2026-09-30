"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { useAction } from "../use-action";

export function ToneEditor({ tone, isDefault, defaultTone }: { tone: string; isDefault: boolean; defaultTone: string }) {
  const { busy, run } = useAction();
  const [value, setValue] = useState(tone);
  return (
    <div className="space-y-2">
      <Textarea rows={7} value={value} onChange={(e) => setValue(e.target.value)} maxLength={4000} aria-label="Recap tone" />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || value === tone}
          onClick={() => run(() => api("/recap-settings", { method: "PUT", body: { tone: value } }), "Recap voice saved")}
        >
          Save voice
        </Button>
        <Button
          variant="outline"
          disabled={busy || (isDefault && value === defaultTone)}
          onClick={() =>
            run(async () => {
              await api("/recap-settings", { method: "PUT", body: { tone: "" } });
              setValue(defaultTone);
            }, "Default voice restored")
          }
        >
          Restore default
        </Button>
      </div>
    </div>
  );
}
