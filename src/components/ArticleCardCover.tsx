type ArticleCardCoverProps = {
  imageUrl?: string | null;
  title: string;
  className?: string;
};

// Spójna okładka karty artykułu: zawsze 16:10, zawsze object-cover.
// Gdy brak zdjęcia, pokazujemy markowy kafelek (zieleń + siateczka) zamiast
// pustego pola. Zoom na hover działa, gdy rodzic ma klasę `group`.
export default function ArticleCardCover({
  imageUrl,
  title,
  className = "",
}: ArticleCardCoverProps) {
  if (imageUrl) {
    return (
      <div className={`relative aspect-[16/10] overflow-hidden bg-surface ${className}`}>
        <img
          src={imageUrl}
          alt={title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-bg ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_28%,rgba(122,163,51,0.18),transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:32px_32px] opacity-40" />
      <span className="relative text-sm font-medium tracking-wide text-fg/62">
        tylkodzialki.pl
      </span>
    </div>
  );
}
