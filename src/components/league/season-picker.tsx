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
        onChange={(e) => {
          // Remember the pick so other screens open on the same season (read by resolveSeason).
          document.cookie = `season=${e.target.value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
          router.push(`${pathname}?season=${e.target.value}`);
        }}
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
