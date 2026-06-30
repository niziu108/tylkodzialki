"use client";

import { useState } from "react";
import { OfficeLogo } from "@/components/OfficeLogo";

// Podgląd logo biura w adminie + przełącznik zielonego tła (#7aa333).
// Białe/jasne logotypy na jasnym tle znikają — zaznaczenie podkłada naszą zieleń.
// Checkbox `biuroLogoBg` jest częścią formularza logo, więc stan zapisuje się na
// koncie biura (User.defaultBiuroLogoBg) i przenosi się na stronę: karty list,
// stronę oferty i popup mapy. Podgląd reaguje na żywo, jeszcze przed zapisem.
export default function LogoPreview({
  src,
  defaultGreen,
}: {
  src: string;
  defaultGreen: boolean;
}) {
  const [green, setGreen] = useState(defaultGreen);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex items-center gap-2 text-xs text-fg/80">
        <input
          type="checkbox"
          name="biuroLogoBg"
          value="1"
          checked={green}
          onChange={(e) => setGreen(e.target.checked)}
          className="h-4 w-4 accent-brand"
        />
        Zielone tło pod logo
      </label>

      <span
        className={`inline-flex items-center rounded-lg px-2 py-1 transition ${
          green ? "bg-brand" : ""
        }`}
      >
        <OfficeLogo src={src} alt="Logo biura" variant="preview" />
      </span>
    </div>
  );
}
