"use client";

import { useState } from "react";
import { OfficeLogo } from "@/components/OfficeLogo";

// Podgląd logo biura w adminie. Białe loga znikają na jasnym tle, więc
// dajemy przełącznik podkładający naszą zieleń (#7aa333) — wtedy widać
// białe logo i można sprawdzić, czy plik jest dobry.
export default function LogoPreview({ src }: { src: string }) {
  const [green, setGreen] = useState(false);

  return (
    <div className="mt-2 flex items-center gap-2">
      <span
        className={`inline-flex items-center rounded-xl px-2 py-1 transition ${
          green ? "bg-brand" : ""
        }`}
      >
        <OfficeLogo src={src} alt="Logo biura" variant="preview" />
      </span>

      <button
        type="button"
        onClick={() => setGreen((v) => !v)}
        aria-pressed={green}
        title="Podłóż zielone tło (sprawdź białe logo)"
        className={`h-7 shrink-0 rounded-lg border px-2 text-[11px] font-medium transition ${
          green
            ? "border-brand bg-brand/15 text-fg"
            : "border-fg/15 text-fg/70 hover:border-brand/50 hover:text-fg"
        }`}
      >
        {green ? "Jasne tło" : "Zielone tło"}
      </button>
    </div>
  );
}
