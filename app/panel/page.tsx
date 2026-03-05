// app/panel/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth-options";
import { prisma } from "@/lib/prisma";
import PanelDzialkiList from "@/components/PanelDzialkiList";

export default async function PanelPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return (
      <div className="min-h-screen bg-[#131313] text-white flex items-center justify-center px-6">
        <div className="text-white/80">Brak dostępu. Zaloguj się.</div>
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user?.id) {
    return (
      <div className="min-h-screen bg-[#131313] text-white flex items-center justify-center px-6">
        <div className="text-white/80">Nie znaleziono użytkownika w bazie.</div>
      </div>
    );
  }

  const items = await prisma.dzialka.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      tytul: true,
      cenaPln: true,
      powierzchniaM2: true,
      locationLabel: true,
      przeznaczenia: true,
      zdjecia: { select: { url: true, publicId: true, kolejnosc: true } },
    },
  });

  return (
    <main className="min-h-screen bg-[#131313] text-[#d9d9d9]">
      <div className="mx-auto max-w-6xl px-6 pt-10 pb-16">
        <div className="mb-8">
          <h1 className="text-[28px] md:text-[34px] font-semibold tracking-tight text-white">
            Panel klienta
          </h1>
        </div>

        <div className="flex items-end justify-between gap-6 border-b border-white/20 mb-10">
          <div className="flex gap-8 text-[16px] md:text-[17px]">
            <Link href="/panel" className="pb-3 border-b-2 border-[#7aa333] text-white">
              Twoje ogłoszenia
            </Link>
            <Link href="/panel/faktury" className="pb-3 text-white/70 hover:text-white">
              Faktury
            </Link>
            <Link href="/panel/ustawienia" className="pb-3 text-white/70 hover:text-white">
              Ustawienia konta
            </Link>
          </div>

          <Link
            href="/sprzedaj"
            className="mb-3 rounded-full px-5 py-2 text-[12px] uppercase tracking-[0.18em] font-semibold text-white
                       border border-[#7aa333]/60 hover:border-[#7aa333] transition"
            style={{ background: "#7aa333" }}
          >
            Dodaj działkę
          </Link>
        </div>

        <div className="text-white/80 text-[18px] font-medium mb-6">Twoje ogłoszenia</div>
        <PanelDzialkiList items={items as any} />
      </div>
    </main>
  );
}