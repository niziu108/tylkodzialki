/**
 * Co trafia do CrmSyncLog razem z pełnym payloadem oferty.
 *
 * Pomiar z 2026-09-09, przy 7,3 tys. ofert: tabela CrmSyncLog ważyła 9 975 MB, cała reszta bazy
 * 170 MB. 8 GB z tego to payloady wpisów UPDATE/SUCCESS — 1,55 mln kopii XML-a oferty po ~5,4 kB,
 * odkładanych codziennie dla każdej oferty, która w ogóle ruszyła. Wartość diagnostyczna bliska
 * zeru (aktualny stan oferty jest w tabeli Dzialka, a poprzedni w DzialkaPriceSnapshot), koszt
 * realny: storage Neona i coraz cięższe zapytania panelu.
 *
 * Przy skali docelowej (50 tys. ofert) ten sam mechanizm dokłada ~270 MB DZIENNIE.
 *
 * Reguła: payload zostaje tam, gdzie faktycznie ratuje śledztwo:
 *   ERROR            — bez wejścia z feedu nie da się odtworzyć, na czym parser się wywrócił,
 *   CREATE           — pierwsze wejście oferty, punkt odniesienia przy sporze o dane,
 *   SKIP_NO_CREDITS  — oferta, która NIE weszła, więc jej treści nie ma nigdzie indziej.
 * Odpada przy UPDATE, REACTIVATE, DEACTIVATE i DELETE.
 */

import type { Prisma } from "@prisma/client";

export type CrmLogAction =
  | "CREATE"
  | "UPDATE"
  | "DEACTIVATE"
  | "REACTIVATE"
  | "SKIP_NO_CREDITS"
  | "DELETE"
  | "ERROR";

export type CrmLogStatus = "SUCCESS" | "ERROR";

/** Sufit na pojedynczy zachowany payload. Jedna monstrualna oferta nie może ważyć jak tysiąc. */
export const MAX_LOG_PAYLOAD_BYTES = 8192;

export function shouldStoreLogPayload(action: CrmLogAction, status: CrmLogStatus): boolean {
  if (status === "ERROR") return true;
  return action === "ERROR" || action === "CREATE" || action === "SKIP_NO_CREDITS";
}

/**
 * Payload do zapisania: `undefined` (pole zostaje puste) albo wersja przycięta, gdy oryginał
 * przekracza sufit. Przycięcie zwraca poprawny JSON z fragmentem tekstu, a nie okaleczoną strukturę.
 */
export function payloadForLog(
  action: CrmLogAction,
  status: CrmLogStatus,
  payload: Prisma.InputJsonValue | undefined
): Prisma.InputJsonValue | undefined {
  if (payload === undefined || payload === null) return undefined;
  if (!shouldStoreLogPayload(action, status)) return undefined;

  let serialized: string;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    return undefined;
  }

  if (serialized.length <= MAX_LOG_PAYLOAD_BYTES) return payload;

  return {
    przyciety: true,
    powod: `Payload ${serialized.length} B przekracza limit ${MAX_LOG_PAYLOAD_BYTES} B.`,
    fragment: serialized.slice(0, MAX_LOG_PAYLOAD_BYTES),
  };
}
