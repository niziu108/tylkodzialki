"use client";

import { deleteUserAction } from "./actions";

export default function DeleteUserForm({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail?: string | null;
}) {
  return (
    <form
      action={deleteUserAction}
      onSubmit={(e) => {
        const ok = window.confirm(
          `Czy na pewno chcesz usunąć konto użytkownika: ${
            userEmail || "bez emaila"
          }?\n\nTej operacji NIE DA się cofnąć.`
        );

        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="userId" value={userId} />

      <button
        type="submit"
        className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
      >
        Usuń konto
      </button>
    </form>
  );
}