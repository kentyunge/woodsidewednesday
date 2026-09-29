"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { Season } from "@/server/league";

export type SeasonForm = {
  name: string;
  year: string;
  startDate: string;
  status: Season["status"];
  handicapPercent: string;
  provisionalPercent: string;
  rollingRounds: string;
  establishRounds: string;
};

export const toForm = (s?: Season | null): SeasonForm => ({
  name: s?.name ?? `${new Date().getFullYear()} Season`,
  year: String(s?.year ?? new Date().getFullYear()),
  startDate: s?.startDate ?? "",
  status: s?.status ?? "upcoming",
  handicapPercent: String((s?.handicapPercent ?? 0.9) * 100),
  provisionalPercent: String((s?.provisionalPercent ?? 0.8) * 100),
  rollingRounds: String(s?.rollingRounds ?? 5),
  establishRounds: String(s?.establishRounds ?? 3),
});

export const fromForm = (f: SeasonForm) => ({
  name: f.name,
  year: Number(f.year),
  startDate: f.startDate,
  status: f.status,
  handicapPercent: Number(f.handicapPercent) / 100,
  provisionalPercent: Number(f.provisionalPercent) / 100,
  rollingRounds: Number(f.rollingRounds),
  establishRounds: Number(f.establishRounds),
});

export function SeasonFields({ form, set }: { form: SeasonForm; set: (f: SeasonForm) => void }) {
  const field = (k: keyof SeasonForm, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} value={form[k]} onChange={(e) => set({ ...form, [k]: e.target.value })} required {...props} />
    </div>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {field("name", "Name")}
      {field("year", "Year", { inputMode: "numeric" })}
      {field("startDate", "First week", { type: "date" })}
      <div className="space-y-1.5">
        <Label htmlFor="status">Status</Label>
        <NativeSelect id="status" value={form.status} onChange={(e) => set({ ...form, status: e.target.value as Season["status"] })}>
          <option value="upcoming">Upcoming</option>
          <option value="active">Active (current)</option>
          <option value="completed">Completed</option>
        </NativeSelect>
      </div>
      {field("handicapPercent", "Handicap % of rolling average", { inputMode: "decimal" })}
      {field("rollingRounds", "Rounds in rolling average", { inputMode: "numeric" })}
      {field("provisionalPercent", "Provisional % (new golfers/subs)", { inputMode: "decimal" })}
      {field("establishRounds", "Rounds to establish a handicap", { inputMode: "numeric" })}
    </div>
  );
}
