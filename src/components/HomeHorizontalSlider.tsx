"use client";

import { useRef } from "react";

type HomeHorizontalSliderProps = {
  children: React.ReactNode;
};

export default function HomeHorizontalSlider({
  children,
}: HomeHorizontalSliderProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  function scrollByAmount(direction: "left" | "right") {
    const el = scrollerRef.current;
    if (!el) return;

    const amount = Math.min(420, Math.round(el.clientWidth * 0.9));
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  return (
    <div className="relative">
      <div className="absolute right-0 top-[-68px] z-10 hidden items-center gap-2 md:flex">
        <button
          type="button"
          onClick={() => scrollByAmount("left")}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
          aria-label="Przewiń w lewo"
        >
          ←
        </button>

        <button
          type="button"
          onClick={() => scrollByAmount("right")}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
          aria-label="Przewiń w prawo"
        >
          →
        </button>
      </div>

      <div
        ref={scrollerRef}
        className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-2 touch-pan-x"
      >
        {children}
      </div>
    </div>
  );
}