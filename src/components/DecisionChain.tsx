import { Fragment } from 'react';

// Cienkie, eleganckie ikony (stroke 1.5) dla kolejnych etapów. Kolor dziedziczony
// (currentColor), więc na hover całego węzła ikona zielenieje przez group-hover.
const svgProps = {
  className: 'h-9 w-9',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

type Step = { label: string; icon: React.ReactNode };

const STEPS: Step[] = [
  {
    label: 'Działka',
    icon: (
      <svg {...svgProps}>
        <path d="M12 21c4-4.4 6-7.6 6-10.5a6 6 0 1 0-12 0C6 13.4 8 16.6 12 21z" />
        <circle cx="12" cy="10.5" r="2.2" />
      </svg>
    ),
  },
  {
    label: 'Projekt',
    icon: (
      <svg {...svgProps}>
        <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" />
        <path d="M14 3v5h5" />
        <path d="M8.5 13h7M8.5 16.5h4.5" />
      </svg>
    ),
  },
  {
    label: 'Kredyt',
    icon: (
      <svg {...svgProps}>
        <path d="M3 9.5 12 4l9 5.5" />
        <path d="M5 10v8M9 10v8M15 10v8M19 10v8" />
        <path d="M3 21h18" />
      </svg>
    ),
  },
  {
    label: 'Przyłącza',
    icon: (
      <svg {...svgProps}>
        <path d="M9 3v5M15 3v5" />
        <path d="M7 8h10v3a5 5 0 0 1-10 0z" />
        <path d="M12 16v5" />
      </svg>
    ),
  },
  {
    label: 'Dom',
    icon: (
      <svg {...svgProps}>
        <path d="M4 11 12 4l8 7" />
        <path d="M6 10v10h12V10" />
        <path d="M10 20v-5h4v5" />
      </svg>
    ),
  },
  {
    label: 'Ogrodzenie',
    icon: (
      <svg {...svgProps}>
        <path d="M5 21V8l1.5-2L8 8v13" />
        <path d="M11 21V8l1.5-2L14 8v13" />
        <path d="M17 21V8l1.5-2L20 8v13" />
        <path d="M3 12h18M3 16.5h18" />
      </svg>
    ),
  },
  {
    label: 'Fotowoltaika',
    icon: (
      <svg {...svgProps}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" />
      </svg>
    ),
  },
];

// Cienka strzałka. Pozioma na desktopie, obrócona w dół na telefonie.
function Arrow() {
  return (
    <svg
      className="h-5 w-5 shrink-0 rotate-90 text-fg/25 xl:rotate-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function DecisionChain() {
  return (
    <div className="flex flex-col items-center gap-y-6 xl:flex-row xl:flex-nowrap xl:items-center xl:justify-between xl:gap-x-2">
      {STEPS.map((s, i) => (
        <Fragment key={s.label}>
          <div className="group flex flex-col items-center gap-3">
            <span
              className="text-fg/45 transition-colors duration-200 group-hover:text-brand"
              aria-hidden="true"
            >
              {s.icon}
            </span>
            <span className="text-[15px] font-medium text-fg/75 transition-colors duration-200 group-hover:text-fg xl:text-base">
              {s.label}
            </span>
          </div>

          {i < STEPS.length - 1 ? <Arrow /> : null}
        </Fragment>
      ))}
    </div>
  );
}
