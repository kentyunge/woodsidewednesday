"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { useAction } from "../use-action";

interface G {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  linked: boolean;
}

function GolferRow({ g }: { g: G }) {
  const { busy, run } = useAction();
  const [name, setName] = useState(g.name);
  const [email, setEmail] = useState(g.email ?? "");
  const [phone, setPhone] = useState(g.phone ?? "");
  const dirty = name !== g.name || email !== (g.email ?? "") || phone !== (g.phone ?? "");
  return (
    <div className="grid gap-2 border-t py-3 sm:grid-cols-[1fr_1.3fr_1fr_auto] sm:items-center">
      <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
      <Input value={email} type="email" placeholder="email (for sign-in)" onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
      <Input value={phone} type="tel" placeholder="phone" onChange={(e) => setPhone(e.target.value)} aria-label="Phone" />
      <div className="flex items-center gap-2">
        {g.linked ? <Badge variant="secondary">Signed in</Badge> : <Badge variant="outline">No login yet</Badge>}
        {dirty && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => run(() => api(`/golfers/${g.id}`, { method: "PATCH", body: { name, email: email || null, phone: phone || null } }), "Saved")}
          >
            Save
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => run(() => api(`/golfers/${g.id}`, { method: "PATCH", body: { active: !g.active } }), g.active ? "Archived" : "Restored")}
        >
          {g.active ? "Archive" : "Restore"}
        </Button>
      </div>
    </div>
  );
}

export function GolfersAdmin({ golfers }: { golfers: G[] }) {
  const { busy, run } = useAction();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  return (
    <div className="space-y-4">
      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Add golfer</CardTitle>
          <CardDescription>A golfer signs in with the email address listed here. Subs don&apos;t need an email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-2 sm:grid-cols-[1fr_1.3fr_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => api("/golfers", { body: { name, email: email || null, phone: phone || null } }), "Golfer added").then(() => {
                setName("");
                setEmail("");
                setPhone("");
              });
            }}
          >
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input placeholder="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button type="submit" disabled={busy}>
              Add
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="gap-1">
        <CardHeader>
          <CardTitle>Golfers</CardTitle>
          <CardDescription>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-primary" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Show archived
            </label>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {golfers
            .filter((g) => showArchived || g.active)
            .map((g) => (
              <GolferRow key={`${g.id}-${g.name}-${g.email}-${g.phone}-${g.active}`} g={g} />
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
