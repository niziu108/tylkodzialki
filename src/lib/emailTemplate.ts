function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildMailTemplate({
  preheader,
  title,
  intro,
  buttonLabel,
  buttonUrl,
  note,
}: {
  preheader: string;
  title: string;
  intro: string;
  buttonLabel: string;
  buttonUrl: string;
  note?: string;
}) {
  const safePreheader = escapeHtml(preheader);
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const safeButtonLabel = escapeHtml(buttonLabel);
  const safeButtonUrl = escapeHtml(buttonUrl);
  const safeNote = note ? escapeHtml(note) : "";

  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
</head>

<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#111;">

<div style="display:none;max-height:0;overflow:hidden;opacity:0;">
${safePreheader}
</div>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
<tr>
<td align="center">

<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e9e9e9;">

<tr>
<td style="background:#ffffff;padding:32px 36px;border-bottom:1px solid #e9e9e9;text-align:center;">
<img
src="cid:logomail"
alt="TylkoDziałki"
width="220"
style="display:inline-block;width:220px;max-width:100%;height:auto;border:0;"
/>
</td>
</tr>

<tr>
<td style="padding:40px 36px 18px 36px;">

<h1 style="margin:0 0 16px 0;font-size:32px;line-height:1.15;color:#131313;font-weight:700;">
${safeTitle}
</h1>

<p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#2d2d2d;white-space:pre-line;">
${safeIntro}
</p>

<table cellpadding="0" cellspacing="0" style="margin:28px 0 24px 0;">
<tr>
<td align="center" bgcolor="#7aa333" style="border-radius:12px;">
<a
href="${safeButtonUrl}"
style="display:inline-block;padding:15px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;"
>
${safeButtonLabel}
</a>
</td>
</tr>
</table>

<p style="margin:0 0 14px 0;font-size:14px;line-height:1.7;color:#5f5f5f;">
Jeśli przycisk nie działa, skopiuj i wklej ten link do przeglądarki:
</p>

<p style="margin:0 0 24px 0;font-size:14px;line-height:1.7;word-break:break-all;">
<a href="${safeButtonUrl}" style="color:#7aa333;text-decoration:none;">
${safeButtonUrl}
</a>
</p>

${
  safeNote
    ? `
<div style="margin:0 0 28px 0;padding:16px 18px;border-radius:14px;background:#f7f9f1;border:1px solid #e2ebcf;color:#4a4a4a;font-size:14px;line-height:1.7;white-space:pre-line;">
${safeNote}
</div>
`
    : ""
}

<div style="margin-top:28px;padding-top:22px;border-top:1px solid #ededed;">

<p style="margin:0 0 10px 0;font-size:15px;line-height:1.7;color:#6b7f34;">
Z poważaniem,
</p>

<p style="margin:0 0 14px 0;font-size:15px;line-height:1.7;color:#6b7f34;">
Biuro Obsługi Klienta
</p>

<img
src="cid:logomail"
alt="TylkoDziałki"
width="160"
style="display:block;width:160px;max-width:100%;height:auto;border:0;"
/>

</div>

</td>
</tr>

</table>

<table width="100%" style="max-width:640px;">
<tr>
<td style="padding:16px 18px 0 18px;text-align:center;color:#8b8b8b;font-size:12px;line-height:1.6;">
Ta wiadomość została wysłana automatycznie z systemu TylkoDziałki.
</td>
</tr>
</table>

</td>
</tr>
</table>

</body>
</html>
`;
}