import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { getCategoryLabel } from "@/lib/articleCategories";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "tylkodzialki.pl";

// Najpierw budujemy zaufanie, potem dopiero estetyka: font ładowany best-effort.
// Gdy fetch padnie, ImageResponse użyje fontu domyślnego (obraz dalej się zwróci).
async function loadInter(
  text: string,
  weight: number
): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&text=${encodeURIComponent(
      text
    )}`;
    const css = await (
      await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
    ).text();
    const match = css.match(
      /src: url\((https:[^)]+)\) format\('(?:truetype|opentype)'\)/
    );
    if (!match) return null;
    return await (await fetch(match[1])).arrayBuffer();
  } catch {
    return null;
  }
}

// Ikona zależna od kategorii (zielony stroke). Domyślnie pin działki.
function renderCategoryIcon(slug: string | null | undefined) {
  const p = {
    width: 46,
    height: 46,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#9fd14b",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (slug) {
    case "formalnosci-i-prawo":
      return (
        <svg {...p}>
          <path d="M14 3v5h5" />
          <path d="M7 3h7l5 5v13H7z" />
          <path d="M9 13h6M9 17h6" />
        </svg>
      );
    case "kupno-dzialki":
      return (
        <svg {...p}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      );
    case "sprzedaz-dzialki":
      return (
        <svg {...p}>
          <path d="M3 11l8-8 10 10-8 8z" />
          <circle cx="8.5" cy="8.5" r="1.4" />
        </svg>
      );
    case "budowa":
      return (
        <svg {...p}>
          <path d="M3 11l9-7 9 7" />
          <path d="M5 10v10h14V10" />
        </svg>
      );
    case "dzialka-rolna":
      return (
        <svg {...p}>
          <path d="M12 22V11" />
          <path d="M12 11C12 7 9 5 4 5c0 4 3 6 8 6Z" />
          <path d="M12 12c0-3 2-5 6-5 0 3-2 5-6 5Z" />
        </svg>
      );
    case "inwestowanie":
      return (
        <svg {...p}>
          <path d="M3 17l6-6 4 4 7-7" />
          <path d="M17 7h4v4" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const article = await prisma.article.findUnique({
    where: { slug },
    select: { title: true, category: true },
  });

  const title = article?.title ?? "tylkodzialki.pl";
  const categoryLabel = getCategoryLabel(article?.category) ?? "Poradnik";

  const titleFontSize = title.length > 75 ? 54 : title.length > 45 ? 64 : 74;

  const fontText =
    title + categoryLabel + "tylkodzialki.pl Poradnik o działkach";
  const [bold, medium] = await Promise.all([
    loadInter(fontText, 700),
    loadInter(fontText, 500),
  ]);

  const fonts: {
    name: string;
    data: ArrayBuffer;
    weight: 500 | 700;
    style: "normal";
  }[] = [];
  if (bold) fonts.push({ name: "Inter", data: bold, weight: 700, style: "normal" });
  if (medium)
    fonts.push({ name: "Inter", data: medium, weight: 500, style: "normal" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#131313",
          padding: "72px",
          position: "relative",
          fontFamily: "Inter",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            background:
              "radial-gradient(circle at 80% 18%, rgba(122,163,51,0.30), transparent 45%), radial-gradient(circle at 12% 92%, rgba(47,94,70,0.32), transparent 42%)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {renderCategoryIcon(article?.category)}
            <div
              style={{
                display: "flex",
                marginLeft: "18px",
                fontSize: "26px",
                fontWeight: 500,
                color: "#9fd14b",
                border: "1px solid rgba(122,163,51,0.40)",
                borderRadius: "999px",
                padding: "9px 22px",
                backgroundColor: "rgba(122,163,51,0.12)",
              }}
            >
              {categoryLabel}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: "27px",
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            tylkodzialki.pl
          </div>
        </div>

        <div style={{ display: "flex", position: "relative" }}>
          <div
            style={{
              display: "flex",
              fontSize: `${titleFontSize}px`,
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.08,
              letterSpacing: "-1px",
              maxWidth: "1056px",
            }}
          >
            {title}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "58px",
              height: "6px",
              borderRadius: "999px",
              backgroundColor: "#7aa333",
            }}
          />
          <div
            style={{
              display: "flex",
              marginLeft: "18px",
              fontSize: "24px",
              fontWeight: 500,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            Poradnik o działkach
          </div>
        </div>
      </div>
    ),
    {
      width: size.width,
      height: size.height,
      fonts: fonts.length ? fonts : undefined,
    }
  );
}
