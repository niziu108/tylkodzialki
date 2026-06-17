import path from "path";

const SITE_URL = "https://tylkodzialki.pl";
const CONTACT_EMAIL = "kontakt@tylkodzialki.pl";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Wspólny załącznik z logo (cid:logo) — sam znak „d", nasz znak rozpoznawczy.
// Każdy mail korzystający z szablonu musi go dołączyć, dlatego trzymamy go w jednym miejscu.
export function mailLogoAttachment() {
  return {
    filename: "logo.png",
    path: path.join(process.cwd(), "public", "logo.png"),
    cid: "logo",
  };
}

export function buildMailTemplate({
  preheader,
  title,
  intro,
  bullets,
  bodyHtml,
  buttonLabel,
  buttonUrl,
  showLinkFallback = false,
  note,
  unsubscribeUrl,
}: {
  /** Tekst widoczny w podglądzie skrzynki przed otwarciem maila. */
  preheader: string;
  title: string;
  /** Akapity treści — podwójny enter robi odstęp między akapitami. */
  intro?: string;
  /** Lista punktów z zielonym „✓". */
  bullets?: string[];
  /** Dodatkowy, gotowy HTML wstawiany po treści (caller sam dba o escapowanie). */
  bodyHtml?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  /** Pokaż link tekstowy pod przyciskiem (tylko maile z tokenem: weryfikacja, reset). */
  showLinkFallback?: boolean;
  note?: string;
  unsubscribeUrl?: string;
}) {
  const safePreheader = escapeHtml(preheader);
  const safeTitle = escapeHtml(title);
  const safeIntro = intro ? escapeHtml(intro) : "";
  const safeButtonLabel = buttonLabel ? escapeHtml(buttonLabel) : "";
  const safeButtonUrl = buttonUrl ? escapeHtml(buttonUrl) : "";
  const safeNote = note ? escapeHtml(note) : "";
  const safeUnsubscribeUrl = unsubscribeUrl ? escapeHtml(unsubscribeUrl) : "";

  const hasButton = Boolean(safeButtonLabel && safeButtonUrl);

  const introHtml = safeIntro
    ? `<p style="margin:0 0 18px 0;font-size:16px;line-height:1.75;color:#4a4a4a;white-space:pre-line;">${safeIntro}</p>`
    : "";

  const bulletsHtml =
    bullets && bullets.length
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 28px 0;width:100%;">${bullets
          .map(
            (b) =>
              `<tr><td valign="top" style="padding:5px 12px 5px 0;width:20px;color:#7aa333;font-size:15px;line-height:1.6;">&#10003;</td><td style="padding:5px 0;font-size:15px;line-height:1.6;color:#4a4a4a;">${escapeHtml(
                b
              )}</td></tr>`
          )
          .join("")}</table>`
      : "";

  const buttonHtml = hasButton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 6px 0;">
<tr>
<td bgcolor="#7aa333" style="border-radius:10px;">
<a href="${safeButtonUrl}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${safeButtonLabel}</a>
</td>
</tr>
</table>`
    : "";

  const linkFallbackHtml =
    hasButton && showLinkFallback
      ? `<p style="margin:18px 0 4px 0;font-size:13px;line-height:1.6;color:#9a9a9a;">Jeśli przycisk nie działa, skopiuj ten link do przeglądarki:</p>
<p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;word-break:break-all;"><a href="${safeButtonUrl}" style="color:#6f7d4f;text-decoration:none;">${safeButtonUrl}</a></p>`
      : "";

  const noteHtml = safeNote
    ? `<div style="margin:26px 0 4px 0;padding:15px 18px;border-radius:12px;background:#f7f7f4;border:1px solid #ececea;color:#555555;font-size:14px;line-height:1.7;white-space:pre-line;">${safeNote}</div>`
    : "";

  const unsubscribeHtml = safeUnsubscribeUrl
    ? `<br /><a href="${safeUnsubscribeUrl}" style="color:#aaaaaa;text-decoration:underline;">Wypisz się z tego alertu</a>`
    : "";

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charSet="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" />
<title>${safeTitle}</title>
</head>

<body style="margin:0;padding:0;background:#f4f4f1;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#1a1a1a;-webkit-font-smoothing:antialiased;">

<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safePreheader}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f1;padding:40px 12px;">
<tr>
<td align="center">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eaeae6;box-shadow:0 6px 24px rgba(0,0,0,0.05);">

<tr>
<td style="padding:40px 44px 0 44px;text-align:center;">
<img src="cid:logo" alt="tylkodzialki.pl" width="50" height="50" style="display:inline-block;width:50px;height:50px;border:0;" />
</td>
</tr>

<tr>
<td style="padding:30px 44px 8px 44px;">

<h1 style="margin:0 0 18px 0;font-size:22px;line-height:1.3;color:#1a1a1a;font-weight:700;">${safeTitle}</h1>

${introHtml}
${bulletsHtml}
${bodyHtml ?? ""}
${buttonHtml}
${linkFallbackHtml}
${noteHtml}

<div style="margin-top:30px;padding-top:22px;border-top:1px solid #f0f0ed;">
<p style="margin:0;font-size:14px;line-height:1.7;color:#8a8a8a;">Pozdrawiamy,</p>
<p style="margin:2px 0 0 0;font-size:14px;line-height:1.7;color:#1a1a1a;font-weight:600;">Zespół tylkodzialki.pl</p>
</div>

</td>
</tr>

</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
<tr>
<td style="padding:24px 24px 0 24px;text-align:center;color:#aaaaaa;font-size:12px;line-height:1.7;">
<a href="${SITE_URL}" style="color:#8a8a8a;text-decoration:none;">tylkodzialki.pl</a>
&nbsp;·&nbsp;
<a href="mailto:${CONTACT_EMAIL}" style="color:#8a8a8a;text-decoration:none;">Kontakt</a>
<br />
Ultima Reality Sp. z o.o. · NIP 7252337429 · ul. Piotrkowska 44/10, 90-265 Łódź
<br />
Ta wiadomość została wysłana automatycznie.${unsubscribeHtml}
</td>
</tr>
</table>

</td>
</tr>
</table>

</body>
</html>`;
}
