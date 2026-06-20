import { Fragment } from 'react';

const STEPS = [
  'Działka',
  'Projekt',
  'Kredyt',
  'Przyłącza',
  'Dom',
  'Ogrodzenie',
  'Fotowoltaika',
];

// Ogniwo łańcucha (dwa zazębione oczka). Poziome na desktopie, obrócone w pionie
// na telefonie, żeby łańcuch „schodził w dół" zamiast strzałek w bok.
function ChainLink() {
  return (
    <span
      className="shrink-0 rotate-90 text-brand-text/45 xl:rotate-0"
      aria-hidden="true"
    >
      <svg width="48" height="22" viewBox="0 0 48 22" fill="none">
        <rect x="2" y="5" width="24" height="12" rx="6" stroke="currentColor" strokeWidth="2" />
        <rect x="22" y="5" width="24" height="12" rx="6" stroke="currentColor" strokeWidth="2" />
      </svg>
    </span>
  );
}

export default function DecisionChain() {
  return (
    <div className="flex flex-col items-center gap-y-5 xl:flex-row xl:flex-nowrap xl:items-center xl:justify-between xl:gap-x-2">
      {STEPS.map((step, i) => (
        <Fragment key={step}>
          <span className="text-[30px] font-semibold leading-none tracking-tight text-fg xl:text-2xl 2xl:text-[28px]">
            <span className="inline-block border-b-2 border-brand/40 pb-1.5">{step}</span>
          </span>

          {i < STEPS.length - 1 ? <ChainLink /> : null}
        </Fragment>
      ))}
    </div>
  );
}
