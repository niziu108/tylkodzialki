import { Fragment } from 'react';

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

// Ikona przyjmuje klasę rozmiaru, bo używamy jej w dwóch wariantach: większa na
// desktopie, mniejsza na telefonie. Kolor dziedziczony (currentColor).
type Step = { label: string; icon: (cls: string) => React.ReactNode };

const STEPS: Step[] = [
  {
    label: 'Działka',
    icon: (cls) => (
      <svg className={cls} {...svgProps}>
        <path d="M12 21c4-4.4 6-7.6 6-10.5a6 6 0 1 0-12 0C6 13.4 8 16.6 12 21z" />
        <circle cx="12" cy="10.5" r="2.2" />
      </svg>
    ),
  },
  {
    label: 'Projekt',
    icon: (cls) => (
      <svg className={cls} {...svgProps}>
        <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" />
        <path d="M14 3v5h5" />
        <path d="M8.5 13h7M8.5 16.5h4.5" />
      </svg>
    ),
  },
  {
    label: 'Kredyt',
    icon: (cls) => (
      <svg className={cls} {...svgProps}>
        <path d="M3 9.5 12 4l9 5.5" />
        <path d="M5 10v8M9 10v8M15 10v8M19 10v8" />
        <path d="M3 21h18" />
      </svg>
    ),
  },
  {
    label: 'Przyłącza',
    icon: (cls) => (
      <svg className={cls} {...svgProps}>
        <path d="M9 3v5M15 3v5" />
        <path d="M7 8h10v3a5 5 0 0 1-10 0z" />
        <path d="M12 16v5" />
      </svg>
    ),
  },
  {
    label: 'Dom',
    icon: (cls) => (
      <svg className={cls} {...svgProps}>
        <path d="M4 11 12 4l8 7" />
        <path d="M6 10v10h12V10" />
        <path d="M10 20v-5h4v5" />
      </svg>
    ),
  },
  {
    label: 'Ogrodzenie',
    icon: (cls) => (
      <svg className={cls} {...svgProps}>
        <path d="M5 21V8l1.5-2L8 8v13" />
        <path d="M11 21V8l1.5-2L14 8v13" />
        <path d="M17 21V8l1.5-2L20 8v13" />
        <path d="M3 12h18M3 16.5h18" />
      </svg>
    ),
  },
  {
    label: 'Fotowoltaika',
    icon: (cls) => (
      <svg className={cls} {...svgProps}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" />
      </svg>
    ),
  },
  {
    label: 'Ogród',
    icon: (cls) => (
      <svg className={cls} {...svgProps}>
        <path d="M12 21v-6" />
        <path d="M12 15c-3.6 0-6-2.2-6-5 0-1.8 1-3.3 2.6-4.1C9.1 4.2 10.4 3.5 12 3.5s2.9.7 3.4 2.4C17 6.7 18 8.2 18 10c0 2.8-2.4 5-6 5Z" />
      </svg>
    ),
  },
];

// Bazowa strzałka wskazuje w prawo. rotate-90 -> w dół, rotate-180 -> w lewo.
function Arrow({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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

// Węzeł mobilny: kompaktowy, ikona zawsze zielona (na telefonie nie ma hovera).
function MobileNode({ s }: { s: Step }) {
  return (
    <div className="flex w-24 flex-col items-center gap-1.5 text-center">
      <span className="text-brand" aria-hidden="true">
        {s.icon('h-10 w-10')}
      </span>
      <span className="text-[13px] font-medium leading-tight text-fg/80">{s.label}</span>
    </div>
  );
}

export default function DecisionChain() {
  return (
    <>
      {/* MOBILE: wąż (zygzak) zamiast długiej kolumny. Strzałki: w bok, w dół, w lewo, w dół... */}
      <div className="flex flex-col gap-y-3 xl:hidden">
        <div className="flex items-center justify-between">
          <MobileNode s={STEPS[0]} />
          <Arrow className="h-4 w-4 shrink-0 text-fg/30" />
          <MobileNode s={STEPS[1]} />
        </div>

        <div className="flex justify-end pr-[2.5rem]">
          <Arrow className="h-4 w-4 shrink-0 rotate-90 text-fg/30" />
        </div>

        <div className="flex items-center justify-between">
          <MobileNode s={STEPS[3]} />
          <Arrow className="h-4 w-4 shrink-0 rotate-180 text-fg/30" />
          <MobileNode s={STEPS[2]} />
        </div>

        <div className="flex justify-start pl-[2.5rem]">
          <Arrow className="h-4 w-4 shrink-0 rotate-90 text-fg/30" />
        </div>

        <div className="flex items-center justify-between">
          <MobileNode s={STEPS[4]} />
          <Arrow className="h-4 w-4 shrink-0 text-fg/30" />
          <MobileNode s={STEPS[5]} />
        </div>

        <div className="flex justify-end pr-[2.5rem]">
          <Arrow className="h-4 w-4 shrink-0 rotate-90 text-fg/30" />
        </div>

        <div className="flex items-center justify-between">
          <MobileNode s={STEPS[7]} />
          <Arrow className="h-4 w-4 shrink-0 rotate-180 text-fg/30" />
          <MobileNode s={STEPS[6]} />
        </div>
      </div>

      {/* DESKTOP: poziomo na całą szerokość, ikona szara -> zielona na hover */}
      <div className="hidden xl:flex xl:flex-row xl:flex-nowrap xl:items-center xl:justify-between xl:gap-x-2">
        {STEPS.map((s, i) => (
          <Fragment key={s.label}>
            <div className="group flex flex-col items-center gap-3">
              <span
                className="text-fg/45 transition-colors duration-200 group-hover:text-brand"
                aria-hidden="true"
              >
                {s.icon('h-11 w-11')}
              </span>
              <span className="text-base font-medium text-fg/75 transition-colors duration-200 group-hover:text-fg">
                {s.label}
              </span>
            </div>

            {i < STEPS.length - 1 ? <Arrow className="h-5 w-5 shrink-0 text-fg/25" /> : null}
          </Fragment>
        ))}
      </div>
    </>
  );
}
