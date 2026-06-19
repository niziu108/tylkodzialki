"use client";

import { useMemo, useState } from "react";
import {
  sendAdminMailAction,
  sendAdminMailTestAction,
} from "./actions";

const LOGIN_URL = "https://tylkodzialki.pl/logowanie";

const TEMPLATE_EXPIRED_SUBJECT =
  "Sprawdź swoje ogłoszenia na tylkodzialki.pl";
const TEMPLATE_EXPIRED_BODY = `Cześć,

sprawdź proszę, czy Twoje ogłoszenia na tylkodzialki.pl są nadal aktualne.

Jeśli któraś oferta wygasła albo wymaga odświeżenia, zaloguj się do swojego konta i sprawdź status ogłoszeń. Warto też od czasu do czasu poprawić opis, zdjęcia i cenę, żeby oferta nadal dobrze się prezentowała.

Zaloguj się do konta i przejdź do swojego panelu, aby sprawdzić swoje oferty.`;

const TEMPLATE_RULES_SUBJECT =
  "Ważna informacja — zmiana regulaminu tylkodzialki.pl";
const TEMPLATE_RULES_BODY = `Cześć,

chcemy poinformować Cię, że na tylkodzialki.pl wprowadziliśmy zmianę regulaminu.

Prosimy, abyś po zalogowaniu do swojego konta zapoznał się z aktualnymi zasadami korzystania z portalu.`;

const TEMPLATE_BACK_SUBJECT =
  "Wracaj na tylkodzialki.pl — nowe oferty już czekają";
const TEMPLATE_BACK_BODY = `Cześć,

na tylkodzialki.pl pojawiają się nowe oferty i warto regularnie zaglądać na portal.

Jeśli szukasz działki albo chcesz sprawdzić, co nowego pojawiło się na rynku, zaloguj się do swojego konta i zobacz najnowsze ogłoszenia.`;

export default function AdminMailComposer() {
  const [subject, setSubject] = useState(TEMPLATE_EXPIRED_SUBJECT);
  const [body, setBody] = useState(TEMPLATE_EXPIRED_BODY);
  const [audience, setAudience] = useState<"ALL" | "LISTER" | "EXPIRED">(
    "LISTER"
  );

  const audienceLabel = useMemo(() => {
    if (audience === "ALL") return "Wszyscy użytkownicy";
    if (audience === "LISTER") return "Użytkownicy z co najmniej 1 ogłoszeniem";
    return "Użytkownicy z wygasłymi / zakończonymi ogłoszeniami";
  }, [audience]);

  const previewParagraphs = useMemo(() => {
    return body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }, [body]);

  function useTemplateExpired() {
    setAudience("LISTER");
    setSubject(TEMPLATE_EXPIRED_SUBJECT);
    setBody(TEMPLATE_EXPIRED_BODY);
  }

  function useTemplateRules() {
    setAudience("ALL");
    setSubject(TEMPLATE_RULES_SUBJECT);
    setBody(TEMPLATE_RULES_BODY);
  }

  function useTemplateBack() {
    setAudience("ALL");
    setSubject(TEMPLATE_BACK_SUBJECT);
    setBody(TEMPLATE_BACK_BODY);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-3xl border border-fg/10 bg-surface p-4 md:p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={useTemplateExpired}
            className="rounded-2xl border border-fg/10 bg-fg/5 px-4 py-2 text-sm font-semibold text-fg transition hover:bg-fg/10"
          >
            Szablon: wygasłe oferty
          </button>

          <button
            type="button"
            onClick={useTemplateRules}
            className="rounded-2xl border border-fg/10 bg-fg/5 px-4 py-2 text-sm font-semibold text-fg transition hover:bg-fg/10"
          >
            Szablon: zmiana regulaminu
          </button>

          <button
            type="button"
            onClick={useTemplateBack}
            className="rounded-2xl border border-fg/10 bg-fg/5 px-4 py-2 text-sm font-semibold text-fg transition hover:bg-fg/10"
          >
            Szablon: powrót na portal
          </button>
        </div>

        <form action={sendAdminMailAction} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-fg">
              Odbiorcy
            </label>
            <select
              name="audience"
              value={audience}
              onChange={(e) =>
                setAudience(e.target.value as "ALL" | "LISTER" | "EXPIRED")
              }
              className="h-12 w-full rounded-2xl border border-fg/10 bg-surface px-4 text-sm text-fg outline-none transition focus:border-brand/60"
            >
              <option value="ALL">Wszyscy użytkownicy</option>
              <option value="LISTER">Użytkownicy z co najmniej 1 ogłoszeniem</option>
              <option value="EXPIRED">
                Użytkownicy z wygasłymi / zakończonymi ogłoszeniami
              </option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-fg">
              Temat maila
            </label>
            <input
              type="text"
              name="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Np. Sprawdź swoje ogłoszenia na tylkodzialki.pl"
              className="h-12 w-full rounded-2xl border border-fg/10 bg-surface px-4 text-sm text-fg outline-none transition placeholder:text-fg/66 focus:border-brand/60"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-fg">
              Treść maila
            </label>
            <textarea
              name="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              placeholder="Wpisz treść wiadomości..."
              className="w-full rounded-2xl border border-fg/10 bg-surface px-4 py-3 text-sm text-fg outline-none transition placeholder:text-fg/66 focus:border-brand/60"
              required
            />
          </div>

          <div className="rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-fg/85">
            Do każdej wiadomości automatycznie zostanie dodany przycisk:
            <span className="font-semibold text-fg"> „Zaloguj się do konta”</span>
            , prowadzący do:
            <span className="font-semibold text-fg"> {LOGIN_URL}</span>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              formAction={sendAdminMailTestAction}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-fg/10 bg-fg/5 px-5 text-sm font-semibold text-fg transition hover:bg-fg/10"
            >
              Wyślij test do admina
            </button>

            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-5 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Wyślij do wybranej grupy
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-fg/10 bg-fg/5 p-4 md:p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-fg">Podgląd maila</h3>
          <p className="mt-1 text-sm text-fg/70">
            Grupa odbiorców: <span className="text-fg">{audienceLabel}</span>
          </p>
        </div>

        <div className="rounded-3xl border border-fg/10 bg-white p-5 text-ink shadow-sm">
          <div className="mb-4 border-b border-black/10 pb-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-text">
              tylkodzialki.pl
            </div>
            <h4 className="mt-2 text-2xl font-semibold">{subject || "Brak tematu"}</h4>
          </div>

          <div className="space-y-4 text-sm leading-7">
            {previewParagraphs.length > 0 ? (
              previewParagraphs.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))
            ) : (
              <p>Brak treści wiadomości.</p>
            )}

            <div className="pt-2">
              <a
                href={LOGIN_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-black no-underline"
              >
                Zaloguj się do konta
              </a>
            </div>

            <p className="pt-2 text-xs text-black/60">
              Link logowania będzie zawsze dodany automatycznie do wysyłanej
              wiadomości.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}