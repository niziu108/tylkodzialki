// Ptaszek marki — czysty glif bez kółka i plakietki ([[feedback-ui-podkreslenia]]).
// Stroke dziedziczy zieleń przez `text-brand` (currentColor), więc kolor ustawia rodzic.
// Wspólny dla listy „co dostajesz w raporcie" na `/sprawdz-dzialke` i na stronie głównej.
export default function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 22 22"
      aria-hidden="true"
      className={`h-[22px] w-[22px] shrink-0 text-brand ${className}`}
    >
      <path
        d="M4 11.5l4.5 4.5L18 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
