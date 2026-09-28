"use client";

import { usePathname, useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";

export function SeasonPicker({ seasons, value }: { seasons: { id: number; name: string }[]; value: number }) {
  const router = useRouter();
  const pathname = usePathname();
  if (seasons.length < 2) return null;
  return (
    <div className="w-44">
      <NativeSelect
        aria-label="Season"
        value={value}
        onChange={(e) => router.push(`${pathname}?season=${e.target.value}`)}
      >
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
